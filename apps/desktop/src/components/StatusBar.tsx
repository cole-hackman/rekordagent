import type { Track } from "../types";

interface Props {
  libraryPath: string;
  trackCount: number | null;
  playingTrack: Track | null;
  isPlaying: boolean;
  pendingChanges: number;
  acceptedChanges: number;
}

function libraryLabel(path: string): string {
  // master.db is at .../PIONEER/rekordbox/master.db — show the parent folder
  // or the filename if no parent is meaningful.
  const segments = path.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return path;
  const file = segments[segments.length - 1];
  const parent = segments[segments.length - 2];
  return parent ? `${parent}/${file}` : file;
}

export function StatusBar({
  libraryPath,
  trackCount,
  playingTrack,
  isPlaying,
  pendingChanges,
  acceptedChanges,
}: Props) {
  return (
    <footer
      role="status"
      aria-label="Application status"
      className="flex h-6 shrink-0 items-center gap-4 border-t border-edge bg-base px-3 font-mono text-[10px] uppercase tracking-wider text-ink-muted"
    >
      {/* Library */}
      <div className="flex items-center gap-1.5" title={libraryPath}>
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
        />
        <span className="truncate normal-case tracking-normal text-ink-secondary">
          {libraryLabel(libraryPath)}
        </span>
      </div>

      {/* Track count */}
      {trackCount != null && (
        <div className="flex items-center gap-1">
          <span className="text-ink-faint">tracks</span>
          <span className="tabular-nums text-ink-secondary">
            {trackCount.toLocaleString()}
          </span>
        </div>
      )}

      {/* Audio playback */}
      {playingTrack && (
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className={
              isPlaying
                ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent-hover"
                : "h-1.5 w-1.5 rounded-full bg-ink-muted"
            }
          />
          <span className="text-ink-faint">{isPlaying ? "playing" : "paused"}</span>
          <span className="truncate normal-case tracking-normal text-ink-secondary">
            {playingTrack.title}
          </span>
        </div>
      )}

      {/* Pending changes */}
      <div className="ml-auto flex items-center gap-3">
        {pendingChanges > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-ink-faint">proposed</span>
            <span className="tabular-nums text-status-info">
              {pendingChanges.toLocaleString()}
            </span>
          </div>
        )}
        {acceptedChanges > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-ink-faint">accepted</span>
            <span className="tabular-nums text-emerald-400">
              {acceptedChanges.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </footer>
  );
}
