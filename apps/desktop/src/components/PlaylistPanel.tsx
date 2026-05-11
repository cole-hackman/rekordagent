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
      <div className="flex h-64 items-center justify-center border-b border-zinc-800">
        <div className="h-5 w-5 animate-spin rounded-full border border-zinc-700 border-t-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-b border-zinc-800 p-4 text-sm text-red-400">
        Failed to load playlists: {error.message}
      </div>
    );
  }

  return (
    <div
      data-testid="playlist-panel"
      className="flex min-h-0 flex-1 border-b border-zinc-800 bg-zinc-950"
    >
      <div className="flex w-64 shrink-0 flex-col border-r border-zinc-800">
        <div className="border-b border-zinc-800 p-2">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter playlists…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visiblePlaylists.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No playlists found.</p>
          ) : (
            visiblePlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => setSelectedId(playlist.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 border-b border-zinc-800/60 px-3 py-2 text-left text-sm",
                  playlist.id === selectedId
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-300 hover:bg-zinc-900",
                ].join(" ")}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="shrink-0 text-xs text-zinc-500">
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
            <div className="h-5 w-5 animate-spin rounded-full border border-zinc-700 border-t-indigo-400" />
          </div>
        ) : detail === null || detail === undefined ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Select a playlist.
          </div>
        ) : detail.tracks.length === 0 ? (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              {detail.playlist.name}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">No tracks in this playlist.</p>
          </div>
        ) : (
          <div>
            <div className="sticky top-0 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
              <h2 className="truncate text-sm font-semibold text-zinc-100">
                {detail.playlist.name}
              </h2>
              <p className="text-xs text-zinc-500">
                {detail.tracks.length.toLocaleString()} tracks
              </p>
            </div>
            {detail.tracks.map((track, index) => (
              <button
                key={`${track.id}-${index}`}
                type="button"
                onClick={() => onSelectTrack?.(track)}
                className={`grid w-full cursor-pointer grid-cols-[3rem_minmax(0,1fr)_9rem_4rem_4rem] gap-3 border-b border-zinc-800/60 px-4 py-2 text-left text-sm transition-colors ${
                  track.id === selectedTrackId
                    ? "bg-indigo-900/40 hover:bg-indigo-900/50"
                    : "hover:bg-zinc-800/60"
                }`}
              >
                <span className="text-right tabular-nums text-zinc-600">
                  {index + 1}
                </span>
                <span className="truncate text-zinc-100">{track.title}</span>
                <span className="truncate text-zinc-400">
                  {track.artist ?? "—"}
                </span>
                <span className="text-right tabular-nums text-zinc-400">
                  {track.bpm != null && track.bpm > 0 ? track.bpm.toFixed(1) : "—"}
                </span>
                <span className="text-center text-zinc-400">
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
