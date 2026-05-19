import { useState } from "react";
import { usePlaylists, buildPlaylistTree } from "../hooks/usePlaylists";
import type { PlaylistNode } from "../hooks/usePlaylists";

interface Props {
  libraryPath: string;
  selectedPlaylistId: string | null;
  onSelectPlaylist: (id: string | null) => void;
}

function PlaylistRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: PlaylistNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isFolder = node.kind === "Folder";
  const isSelected = node.id === selectedId;

  return (
    <>
      <div
        className={[
          "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors",
          isSelected
            ? "bg-indigo-900/40 text-indigo-200"
            : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
        ].join(" ")}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (isFolder) {
            setExpanded((v) => !v);
          } else {
            onSelect(isSelected ? null : node.id);
          }
        }}
      >
        {/* Expand chevron for folders */}
        {isFolder ? (
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 shrink-0 text-zinc-600"
          >
            <path d="M4.75 1a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h6.5a.75.75 0 00.75-.75V5.56a.75.75 0 00-.22-.53L8.22 1.22A.75.75 0 007.69 1H4.75zm-.25 1.5h2.69v3a.75.75 0 00.75.75h3v8h-6V2.5zm4.19.31L10.44 5H8.69V2.81z" />
          </svg>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isFolder && expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <PlaylistRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function PlaylistBrowser({ libraryPath, selectedPlaylistId, onSelectPlaylist }: Props) {
  const { data: playlists, isLoading, error } = usePlaylists(libraryPath);

  const tree = playlists ? buildPlaylistTree(playlists) : [];

  return (
    <div className="flex h-full w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div
        className={[
          "flex shrink-0 cursor-pointer items-center gap-2 border-b border-zinc-800 px-3 py-2.5",
          !selectedPlaylistId ? "text-indigo-300" : "text-zinc-400 hover:text-zinc-200",
        ].join(" ")}
        onClick={() => onSelectPlaylist(null)}
        title="Show entire library"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
          <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3A1.5 1.5 0 0115 10.5v3A1.5 1.5 0 0113.5 15h-3A1.5 1.5 0 019 13.5v-3z" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider">All Tracks</span>
      </div>

      {/* Playlist tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-indigo-400" />
          </div>
        )}
        {error && (
          <p className="px-3 py-2 text-xs text-red-400">Failed to load playlists.</p>
        )}
        {!isLoading && !error && tree.length === 0 && (
          <p className="px-3 py-2 text-xs text-zinc-600">No playlists.</p>
        )}
        {tree.map((node) => (
          <PlaylistRow
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedPlaylistId}
            onSelect={onSelectPlaylist}
          />
        ))}
      </div>
    </div>
  );
}
