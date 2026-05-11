import { useTrackCues } from "../hooks/useTrackCues";
import { WaveformDisplay } from "./WaveformDisplay";
import type { Track, HotCue, CueKind } from "../types";

const STAR_RATINGS = [0, 1, 2, 3, 4, 5] as const;

function formatMs(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function cueSlotLabel(kind: CueKind): string {
  if (kind === "MemoryCue") return "M";
  return String(kind.HotCue);
}

const HOT_CUE_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-pink-500",
];

function cueColor(kind: CueKind): string {
  if (kind === "MemoryCue") return "bg-zinc-400";
  return HOT_CUE_COLORS[(kind.HotCue - 1) % HOT_CUE_COLORS.length];
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline gap-1">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="truncate text-sm text-zinc-200">{value}</span>
    </div>
  );
}

function CueRow({ cue }: { cue: HotCue }) {
  const slot = cueSlotLabel(cue.kind);
  const color = cueColor(cue.kind);
  return (
    <div className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-zinc-800">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white ${color}`}
      >
        {slot}
      </span>
      <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-zinc-300">
        {cue.in_msec != null ? formatMs(cue.in_msec) : "—"}
      </span>
      <span className="truncate text-xs text-zinc-400">
        {cue.comment ?? ""}
      </span>
    </div>
  );
}

interface Props {
  track: Track;
  libraryPath: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function TrackDetailPanel({ track, libraryPath, isPlaying, onTogglePlay }: Props) {
  const { data: cues = [], isLoading: cuesLoading } = useTrackCues(
    libraryPath,
    track.id,
  );

  const sortedCues = [...cues].sort(
    (a, b) => (a.in_msec ?? 0) - (b.in_msec ?? 0),
  );

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onTogglePlay}
            disabled={!track.folder_path}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying ? (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M4 2.5l9 5.5-9 5.5V2.5z" />
              </svg>
            )}
          </button>
          <div className="min-w-0">
            <h2
              className="truncate text-base font-semibold leading-tight text-zinc-100"
              title={track.title}
            >
              {track.title}
            </h2>
            {track.artist && (
              <p className="mt-0.5 truncate text-sm text-zinc-400">{track.artist}</p>
            )}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="mx-4 mt-4">
        <WaveformDisplay
          audioPath={track.folder_path}
          cueTimestampsMs={sortedCues.map((c) => c.in_msec ?? 0)}
          isPlaying={isPlaying}
        />
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1.5 p-4">
        <MetaRow label="Album" value={track.album} />
        <MetaRow label="Genre" value={track.genre} />
        <MetaRow label="BPM" value={track.bpm != null ? track.bpm.toFixed(1) : null} />
        <MetaRow label="Key" value={track.musical_key} />
        <MetaRow
          label="Duration"
          value={track.duration_secs != null ? formatDuration(track.duration_secs) : null}
        />
        <MetaRow
          label="Rating"
          value={
            track.rating != null && track.rating > 0 ? (
              <span aria-label={`${track.rating} stars`}>
                {STAR_RATINGS.slice(1).map((n) => (
                  <span key={n} className={n <= track.rating! ? "text-yellow-400" : "text-zinc-700"}>
                    ★
                  </span>
                ))}
              </span>
            ) : null
          }
        />
        <MetaRow label="Year" value={track.release_year} />
        <MetaRow label="Plays" value={track.dj_play_count} />
        {track.comment && (
          <div className="mt-1">
            <p className="text-xs text-zinc-500">Comment</p>
            <p className="mt-0.5 text-sm text-zinc-300 break-words">{track.comment}</p>
          </div>
        )}
      </div>

      {/* Hot cues */}
      <div className="px-4 pb-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Cues
        </h3>
        {cuesLoading ? (
          <div className="flex justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-indigo-400" />
          </div>
        ) : sortedCues.length === 0 ? (
          <p className="text-xs text-zinc-600">No cues.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sortedCues.map((cue) => (
              <CueRow key={cue.id} cue={cue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
