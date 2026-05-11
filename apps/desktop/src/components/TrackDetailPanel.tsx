import { useTrackCues } from "../hooks/useTrackCues";
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
  if (kind === "MemoryCue") return "bg-ink-secondary";
  return HOT_CUE_COLORS[(kind.HotCue - 1) % HOT_CUE_COLORS.length];
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline gap-3 py-1">
      <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
      <span
        className={
          mono
            ? "truncate font-mono text-[13px] tabular-nums text-ink"
            : "truncate text-sm text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

function CueRow({ cue }: { cue: HotCue }) {
  const slot = cueSlotLabel(cue.kind);
  const color = cueColor(cue.kind);
  return (
    <div className="flex items-center gap-3 rounded px-2 py-1.5 transition-colors duration-150 hover:bg-surface">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-bold text-base ${color}`}
      >
        {slot}
      </span>
      <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-ink-secondary">
        {cue.in_msec != null ? formatMs(cue.in_msec) : "—"}
      </span>
      <span className="truncate text-xs text-ink-secondary">
        {cue.comment ?? ""}
      </span>
    </div>
  );
}

/** Convert a Tailwind `bg-*` class for a cue color to a hex value for SVG
 *  rendering. Keeps the cue palette as the single source of truth. */
const CUE_HEX: Record<string, string> = {
  "bg-red-500": "#ef4444",
  "bg-orange-500": "#f97316",
  "bg-yellow-400": "#facc15",
  "bg-green-500": "#22c55e",
  "bg-cyan-500": "#06b6d4",
  "bg-blue-500": "#3b82f6",
  "bg-violet-500": "#8b5cf6",
  "bg-pink-500": "#ec4899",
  "bg-ink-secondary": "rgb(var(--text-secondary))",
};

function CuePositionBar({
  cues,
  durationSecs,
}: {
  cues: HotCue[];
  durationSecs: number | null;
}) {
  const durationMs =
    durationSecs != null && durationSecs > 0 ? durationSecs * 1000 : null;

  // Sorted positions of valid cues for region rendering.
  const positioned = (cues ?? [])
    .filter((c) => c.in_msec != null && c.in_msec >= 0)
    .sort((a, b) => (a.in_msec ?? 0) - (b.in_msec ?? 0));

  return (
    <div className="mx-4 mt-4 select-none">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] tabular-nums text-ink-faint">
        <span>0:00</span>
        <span>
          {durationSecs != null && durationSecs > 0
            ? formatDuration(durationSecs)
            : "—:—"}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative h-14 overflow-hidden rounded-md border border-edge bg-elevated">
        {/* Cue regions — faint colored band starting at each cue */}
        {durationMs &&
          positioned.map((cue, i) => {
            const startPct = Math.min(
              100,
              Math.max(0, ((cue.in_msec ?? 0) / durationMs) * 100),
            );
            const next = positioned[i + 1];
            const endPct = next
              ? Math.min(100, ((next.in_msec ?? 0) / durationMs) * 100)
              : 100;
            const width = Math.max(0, endPct - startPct);
            const hex = CUE_HEX[cueColor(cue.kind)] ?? "rgb(var(--text-muted))";
            return (
              <div
                key={`region-${cue.id}`}
                aria-hidden
                className="absolute top-0 bottom-0"
                style={{
                  left: `${startPct}%`,
                  width: `${width}%`,
                  background: `linear-gradient(to bottom, ${hex}22 0%, ${hex}08 50%, transparent 100%)`,
                }}
              />
            );
          })}

        {/* Center baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-edge" />

        {/* Quarter tick marks */}
        {[0.25, 0.5, 0.75].map((p) => (
          <div
            key={p}
            aria-hidden
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-edge-strong"
            style={{ left: `${p * 100}%` }}
          />
        ))}

        {/* Cue markers (vertical bar + top badge) */}
        {durationMs &&
          positioned.map((cue) => {
            const pos = cue.in_msec ?? 0;
            const pct = Math.min(100, Math.max(0, (pos / durationMs) * 100));
            const color = cueColor(cue.kind);
            const label = cueSlotLabel(cue.kind);
            return (
              <div
                key={cue.id}
                className="absolute top-0 bottom-0 flex flex-col items-center"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                title={`${label} · ${cue.in_msec != null ? formatMs(cue.in_msec) : ""}${cue.comment ? ` — ${cue.comment}` : ""}`}
              >
                {/* Top label badge */}
                <span
                  className={`mt-0.5 flex h-3 min-w-[12px] items-center justify-center rounded-sm px-[3px] font-mono text-[9px] font-bold leading-none text-base ${color}`}
                >
                  {label}
                </span>
                {/* Vertical line */}
                <div className={`mt-0.5 w-[2px] flex-1 ${color}`} />
              </div>
            );
          })}

        {/* Empty state */}
        {durationMs === null && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            no duration
          </div>
        )}
        {durationMs !== null && positioned.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            no cue points
          </div>
        )}
      </div>
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
  const { data: cues = [], isLoading: cuesLoading, error: cuesError } = useTrackCues(
    libraryPath,
    track.id,
  );

  const sortedCues = [...cues].sort(
    (a, b) => (a.in_msec ?? 0) - (b.in_msec ?? 0),
  );

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-edge bg-base animate-[slideInRight_150ms_ease-out]">
      {/* Header */}
      <div className="border-b border-edge p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onTogglePlay}
            disabled={!track.folder_path}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying ? (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" className="ml-0.5 h-4 w-4">
                <path d="M4 2.5l9 5.5-9 5.5V2.5z" />
              </svg>
            )}
          </button>
          <div className="min-w-0">
            <h2
              className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ink"
              title={track.title}
            >
              {track.title}
            </h2>
            {track.artist && (
              <p className="mt-1 truncate text-[13px] text-ink-secondary">
                {track.artist}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cue position bar */}
      <CuePositionBar cues={sortedCues} durationSecs={track.duration_secs ?? null} />

      {/* Metadata */}
      <section className="border-b border-edge/60 px-4 pb-4 pt-4">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          Metadata
        </h3>
        <div className="flex flex-col">
          <MetaRow label="Album" value={track.album} />
          <MetaRow label="Genre" value={track.genre} />
          <MetaRow
            label="BPM"
            mono
            value={track.bpm != null && track.bpm > 0 ? track.bpm.toFixed(1) : null}
          />
          <MetaRow label="Key" mono value={track.musical_key} />
          <MetaRow
            label="Duration"
            mono
            value={track.duration_secs != null && track.duration_secs > 0 ? formatDuration(track.duration_secs) : null}
          />
          <MetaRow
            label="Rating"
            value={
              track.rating != null && track.rating > 0 ? (
                <span aria-label={`${track.rating} stars`}>
                  {STAR_RATINGS.slice(1).map((n) => (
                    <span key={n} className={n <= track.rating! ? "text-accent-hover" : "text-ink-faint"}>
                      ★
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
          <MetaRow
            label="Year"
            mono
            value={track.release_year != null && track.release_year > 0 ? track.release_year : null}
          />
          <MetaRow label="Plays" mono value={track.dj_play_count} />
        </div>
        {track.comment && (
          <div className="mt-3 border-t border-edge/60 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              Comment
            </p>
            <p className="text-[13px] leading-relaxed text-ink-secondary break-words">
              {track.comment}
            </p>
          </div>
        )}
      </section>

      {/* Hot cues */}
      <section className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Cues
          </h3>
          {sortedCues.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
              {sortedCues.length}
            </span>
          )}
        </div>
        {cuesLoading ? (
          <div className="flex justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border border-edge-strong border-t-accent-hover" />
          </div>
        ) : cuesError ? (
          <div className="rounded border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-300">
            <p className="font-medium">Cue load failed</p>
            <p className="mt-1 break-words text-red-300/80">{cuesError.message}</p>
          </div>
        ) : sortedCues.length === 0 ? (
          <p className="text-xs text-ink-faint">No cues.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sortedCues.map((cue) => (
              <CueRow key={cue.id} cue={cue} />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
