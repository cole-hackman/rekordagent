import { useMemo, useState, useEffect } from "react";
import { usePlaylistDetail, usePlaylists } from "../hooks/usePlaylists";
import type { Playlist, Track } from "../types";

interface Props {
  libraryPath: string;
  selectedTrackId?: string | null;
  onSelectTrack?: (track: Track) => void;
}

function kindLabel(kind: Playlist["kind"]): string {
  if (typeof kind === "string") return kind;
  return "Unknown";
}

export function PlaylistPanel({
  libraryPath,
  selectedTrackId,
  onSelectTrack,
}: Props) {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: playlists = [], isLoading, error } = usePlaylists(libraryPath);

  const visiblePlaylists = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return playlists.filter((playlist) => {
      if (playlist.kind === "Folder") return false;
      if (!q) return true;
      return playlist.name.toLowerCase().includes(q);
    });
  }, [playlists, filter]);

  useEffect(() => {
    const selectedVisible = visiblePlaylists.some(
      (playlist) => playlist.id === selectedId,
    );
    if ((selectedId === null || !selectedVisible) && visiblePlaylists.length > 0) {
      setSelectedId(visiblePlaylists[0].id);
    } else if (!selectedVisible && visiblePlaylists.length === 0) {
      setSelectedId(null);
    }
  }, [selectedId, visiblePlaylists]);

  const { data: detail, isLoading: detailLoading } = usePlaylistDetail(
    libraryPath,
    selectedId,
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center border-b border-edge">
        <div className="h-5 w-5 animate-spin rounded-full border border-edge-strong border-t-accent-hover" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-edge p-4 text-sm text-red-400">
        Failed to load playlists: {error.message}
      </div>
    );
  }

  return (
    <div
      data-testid="playlist-panel"
      className="flex min-h-0 flex-1 border-b border-edge bg-base"
    >
      <div className="flex w-64 shrink-0 flex-col border-r border-edge">
        <div className="border-b border-edge p-2">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter playlists…"
            className="w-full rounded-md border border-edge-strong bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visiblePlaylists.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No playlists found.</p>
          ) : (
            visiblePlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => setSelectedId(playlist.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 border-b border-edge/60 px-3 py-2 text-left text-sm",
                  playlist.id === selectedId
                    ? "bg-elevated text-ink"
                    : "text-ink-secondary hover:bg-surface",
                ].join(" ")}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {kindLabel(playlist.kind)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {detailLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border border-edge-strong border-t-accent-hover" />
          </div>
        ) : detail === null || detail === undefined ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            Select a playlist.
          </div>
        ) : detail.tracks.length === 0 ? (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-ink">
              {detail.playlist.name}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">No tracks in this playlist.</p>
          </div>
        ) : (
          <div>
            <div className="sticky top-0 border-b border-edge bg-base px-4 py-2">
              <h2 className="truncate text-sm font-semibold text-ink">
                {detail.playlist.name}
              </h2>
              <p className="text-xs text-ink-muted">
                <span className="font-mono tabular-nums">
                  {detail.tracks.length.toLocaleString()}
                </span>{" "}
                tracks
              </p>
            </div>
            {detail.tracks.map((track, index) => (
              <button
                key={`${track.id}-${index}`}
                type="button"
                onClick={() => onSelectTrack?.(track)}
                className={`grid w-full cursor-pointer grid-cols-[3rem_minmax(0,1fr)_9rem_4rem_4rem] gap-3 border-b border-edge/60 px-4 py-2 text-left text-sm transition-colors ${
                  track.id === selectedTrackId
                    ? "bg-accent-dim/40 hover:bg-accent-dim/50"
                    : "hover:bg-elevated/60"
                }`}
              >
                <span className="text-right font-mono tabular-nums text-xs text-ink-faint">
                  {index + 1}
                </span>
                <span className="truncate text-ink">{track.title}</span>
                <span className="truncate text-ink-secondary">
                  {track.artist ?? "—"}
                </span>
                <span className="text-right font-mono tabular-nums text-[13px] text-ink-secondary">
                  {track.bpm != null && track.bpm > 0 ? track.bpm.toFixed(1) : "—"}
                </span>
                <span className="text-center font-mono tabular-nums text-[13px] text-ink-secondary">
                  {track.musical_key ?? "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
