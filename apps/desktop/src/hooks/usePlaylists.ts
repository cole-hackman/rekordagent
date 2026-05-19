import { useQuery } from "@tanstack/react-query";
import { listPlaylists } from "../ipc";
import type { Playlist } from "../types";

export function usePlaylists(libraryPath: string) {
  return useQuery<Playlist[], Error>({
    queryKey: ["playlists", libraryPath],
    queryFn: () => listPlaylists(libraryPath),
    staleTime: 60_000,
  });
}

/** Build a tree from a flat playlist list. */
export interface PlaylistNode extends Playlist {
  children: PlaylistNode[];
}

export function buildPlaylistTree(playlists: Playlist[]): PlaylistNode[] {
  const byId = new Map<string, PlaylistNode>();
  for (const p of playlists) {
    byId.set(p.id, { ...p, children: [] });
  }
  const roots: PlaylistNode[] = [];
  for (const node of byId.values()) {
    if (!node.parent_id || !byId.has(node.parent_id)) {
      roots.push(node);
    } else {
      byId.get(node.parent_id)!.children.push(node);
    }
  }
  // Sort by seq within each level.
  const sortChildren = (nodes: PlaylistNode[]) => {
    nodes.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}
