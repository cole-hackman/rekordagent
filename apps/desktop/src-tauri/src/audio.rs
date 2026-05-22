use rodio::{Decoder, OutputStream, Sink, Source};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub enum AudioCmd {
    Play(PathBuf),
    Pause,
    Resume,
    Stop,
    Seek(Duration),
}

#[derive(Clone, Serialize)]
pub struct PlaybackState {
    pub is_playing: bool,
    pub path: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct PlaybackStatus {
    pub is_playing: bool,
    pub path: Option<String>,
    /// Current playback position in seconds.
    pub time: f64,
    /// Total duration in seconds, 0 if unknown.
    pub duration: f64,
}

/// Internal authoritative state — owned by the audio thread but observable
/// via the shared `Mutex` so Tauri commands can read it.
struct PlayerState {
    is_playing: bool,
    path: Option<String>,
    /// Total duration of the loaded source, if it was reported by the decoder.
    duration: Option<Duration>,
    /// Playback offset accumulated from previous play/pause/seek segments.
    accumulated: Duration,
    /// Wall-clock instant that the current playing segment began; `None` when paused.
    segment_started_at: Option<Instant>,
}

impl PlayerState {
    fn elapsed(&self) -> Duration {
        let mut t = self.accumulated;
        if let Some(start) = self.segment_started_at {
            t += start.elapsed();
        }
        if let Some(total) = self.duration {
            if t > total {
                t = total;
            }
        }
        t
    }
}

/// Audio player backed by a dedicated OS thread that owns the OutputStream.
/// OutputStream is !Send, so it must never cross thread boundaries.
pub struct AudioPlayer {
    tx: mpsc::SyncSender<AudioCmd>,
    state: Arc<Mutex<PlayerState>>,
}

impl AudioPlayer {
    pub fn new(app: Option<AppHandle>) -> Self {
        let (tx, rx) = mpsc::sync_channel::<AudioCmd>(8);
        let state = Arc::new(Mutex::new(PlayerState {
            is_playing: false,
            path: None,
            duration: None,
            accumulated: Duration::ZERO,
            segment_started_at: None,
        }));
        let state2 = Arc::clone(&state);

        std::thread::spawn(move || {
            let Ok((_stream, handle)) = OutputStream::try_default() else {
                tracing::error!("audio: no output device available");
                return;
            };
            let Ok(sink) = Sink::try_new(&handle) else {
                tracing::error!("audio: could not create sink");
                return;
            };

            // Tick the channel every 250ms even when no commands arrive so we
            // can notice when rodio's sink empties (track finished playing).
            loop {
                let cmd_result = rx.recv_timeout(Duration::from_millis(250));

                // End-of-stream detection: sink reports empty while we still
                // think we're playing. Clear is_playing and notify the UI.
                {
                    let mut s = state2.lock().unwrap();
                    if s.is_playing && sink.empty() {
                        if let Some(start) = s.segment_started_at.take() {
                            s.accumulated += start.elapsed();
                        }
                        if let Some(total) = s.duration {
                            if s.accumulated > total {
                                s.accumulated = total;
                            }
                        }
                        s.is_playing = false;
                        if let Some(ref app) = app {
                            let _ = app.emit("playback-ended", ());
                        }
                    }
                }

                let cmd = match cmd_result {
                    Ok(c) => c,
                    Err(RecvTimeoutError::Timeout) => continue,
                    Err(RecvTimeoutError::Disconnected) => break,
                };

                match cmd {
                    AudioCmd::Play(path) => {
                        sink.clear();
                        let result =
                            (|| -> Result<Option<Duration>, Box<dyn std::error::Error + Send + Sync>> {
                                let src = Decoder::new(BufReader::new(File::open(&path)?))?;
                                let dur = src.total_duration();
                                sink.append(src);
                                sink.play();
                                Ok(dur)
                            })();
                        let mut s = state2.lock().unwrap();
                        match result {
                            Ok(duration) => {
                                s.is_playing = true;
                                s.path = path.to_str().map(|p| p.to_owned());
                                s.duration = duration;
                                s.accumulated = Duration::ZERO;
                                s.segment_started_at = Some(Instant::now());
                            }
                            Err(e) => tracing::error!("audio play error: {e}"),
                        }
                    }
                    AudioCmd::Pause => {
                        sink.pause();
                        let mut s = state2.lock().unwrap();
                        if let Some(start) = s.segment_started_at.take() {
                            s.accumulated += start.elapsed();
                        }
                        s.is_playing = false;
                    }
                    AudioCmd::Resume => {
                        sink.play();
                        let mut s = state2.lock().unwrap();
                        s.is_playing = true;
                        if s.segment_started_at.is_none() {
                            s.segment_started_at = Some(Instant::now());
                        }
                    }
                    AudioCmd::Stop => {
                        sink.clear();
                        let mut s = state2.lock().unwrap();
                        s.is_playing = false;
                        s.path = None;
                        s.duration = None;
                        s.accumulated = Duration::ZERO;
                        s.segment_started_at = None;
                    }
                    AudioCmd::Seek(pos) => {
                        let clamped = {
                            let s = state2.lock().unwrap();
                            match s.duration {
                                Some(total) if pos > total => total,
                                _ => pos,
                            }
                        };
                        match sink.try_seek(clamped) {
                            Ok(()) => {
                                let mut s = state2.lock().unwrap();
                                s.accumulated = clamped;
                                if s.is_playing {
                                    s.segment_started_at = Some(Instant::now());
                                } else {
                                    s.segment_started_at = None;
                                }
                            }
                            Err(e) => tracing::warn!("audio seek error: {e}"),
                        }
                    }
                }
            }
        });

        Self { tx, state }
    }

    pub fn send(&self, cmd: AudioCmd) -> Result<(), String> {
        self.tx.send(cmd).map_err(|e| e.to_string())
    }

    pub fn playback_state(&self) -> PlaybackState {
        let s = self.state.lock().unwrap();
        PlaybackState {
            is_playing: s.is_playing,
            path: s.path.clone(),
        }
    }

    pub fn playback_status(&self) -> PlaybackStatus {
        let s = self.state.lock().unwrap();
        PlaybackStatus {
            is_playing: s.is_playing,
            path: s.path.clone(),
            time: s.elapsed().as_secs_f64(),
            duration: s.duration.map(|d| d.as_secs_f64()).unwrap_or(0.0),
        }
    }
}
