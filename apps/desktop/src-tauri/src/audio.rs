use rodio::{Decoder, OutputStream, Sink};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

pub enum AudioCmd {
    Play(PathBuf),
    Pause,
    Resume,
    Stop,
}

#[derive(Clone, Serialize)]
pub struct PlaybackState {
    pub is_playing: bool,
    pub path: Option<String>,
}

/// Audio player backed by a dedicated OS thread that owns the OutputStream.
/// OutputStream is !Send, so it must never cross thread boundaries.
pub struct AudioPlayer {
    tx: mpsc::SyncSender<AudioCmd>,
    state: Arc<Mutex<PlaybackState>>,
}

impl AudioPlayer {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::sync_channel::<AudioCmd>(8);
        let state = Arc::new(Mutex::new(PlaybackState {
            is_playing: false,
            path: None,
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

            for cmd in rx {
                match cmd {
                    AudioCmd::Play(path) => {
                        sink.clear();
                        let result =
                            (|| -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
                                let src = Decoder::new(BufReader::new(File::open(&path)?))?;
                                sink.append(src);
                                sink.play();
                                Ok(())
                            })();
                        let mut s = state2.lock().unwrap();
                        match result {
                            Ok(_) => {
                                s.is_playing = true;
                                s.path = path.to_str().map(|p| p.to_owned());
                            }
                            Err(e) => tracing::error!("audio play error: {e}"),
                        }
                    }
                    AudioCmd::Pause => {
                        sink.pause();
                        state2.lock().unwrap().is_playing = false;
                    }
                    AudioCmd::Resume => {
                        sink.play();
                        state2.lock().unwrap().is_playing = true;
                    }
                    AudioCmd::Stop => {
                        sink.clear();
                        let mut s = state2.lock().unwrap();
                        s.is_playing = false;
                        s.path = None;
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
        self.state.lock().unwrap().clone()
    }
}
