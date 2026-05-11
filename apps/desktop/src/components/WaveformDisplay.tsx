import { useRef } from "react";
import { useWaveform } from "../hooks/useWaveform";

interface Props {
  audioPath: string | null;
  /** Cue timestamps in milliseconds. */
  cueTimestampsMs?: number[];
  isPlaying: boolean;
}

export function WaveformDisplay({ audioPath, cueTimestampsMs = [], isPlaying }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cueTimestampsSec = cueTimestampsMs.map((ms) => ms / 1000);

  useWaveform({
    container: containerRef,
    audioPath,
    cueTimestamps: cueTimestampsSec,
    isPlaying,
  });

  return (
    <div
      ref={containerRef}
      className="h-16 w-full overflow-hidden rounded-md bg-zinc-900"
      aria-label="Track waveform"
    />
  );
}
