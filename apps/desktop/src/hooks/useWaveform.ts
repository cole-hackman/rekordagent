import { useEffect, useRef, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { convertFileSrc } from "@tauri-apps/api/core";

interface UseWaveformOptions {
  container: React.RefObject<HTMLDivElement | null>;
  audioPath: string | null;
  /** Resolved cue markers in seconds from track start. */
  cueTimestamps?: number[];
  isPlaying: boolean;
}

export function useWaveform({
  container,
  audioPath,
  cueTimestamps = [],
  isPlaying,
}: UseWaveformOptions) {
  const wsRef = useRef<WaveSurfer | null>(null);

  // Destroy and recreate WaveSurfer whenever the container or audio changes.
  useEffect(() => {
    if (!container.current || !audioPath) return;

    const ws = WaveSurfer.create({
      container: container.current,
      waveColor: "#3f3f46",        // zinc-700
      progressColor: "#6366f1",   // indigo-500
      cursorColor: "#818cf8",     // indigo-400
      cursorWidth: 1,
      height: 64,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: false,            // scrubbing wired separately
      backend: "WebAudio",
    });

    wsRef.current = ws;

    const src = convertFileSrc(audioPath);
    ws.load(src).catch(() => {
      // Silently ignore load errors (unsupported format, missing file).
    });

    // Draw cue markers after waveform is decoded.
    ws.on("ready", () => {
      const duration = ws.getDuration();
      if (!duration || !container.current) return;

      for (const t of cueTimestamps) {
        const pct = t / duration;
        const marker = document.createElement("div");
        marker.style.cssText = `
          position: absolute;
          top: 0;
          left: ${pct * 100}%;
          width: 1px;
          height: 100%;
          background: rgba(250, 204, 21, 0.7);
          pointer-events: none;
          z-index: 10;
        `;
        container.current.style.position = "relative";
        container.current.appendChild(marker);
      }
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPath, container]);

  // Sync WaveSurfer cursor to playback state — WaveSurfer doesn't drive audio,
  // rodio does; we just keep the progress indicator in sync.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (isPlaying) {
      // WaveSurfer's own play/pause is used only to animate the cursor.
      ws.play().catch(() => {});
    } else {
      ws.pause();
    }
  }, [isPlaying]);

  const seekTo = useCallback((fraction: number) => {
    wsRef.current?.seekTo(Math.max(0, Math.min(1, fraction)));
  }, []);

  return { seekTo };
}
