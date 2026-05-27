import { useQuery } from "@tanstack/react-query";
import { getPlaylist, listPlaylists } from "../ipc";
import type { Playlist, PlaylistDetail } from "../types";

export function usePlaylists(libraryPath: string | null) {
  return useQuery<Playlist[], Error>({
    queryKey: ["playlists", libraryPath],
    queryFn: () => listPlaylists(libraryPath!),
    enabled: libraryPath !== null,
    staleTime: Infinity,
  });
}

export function usePlaylistDetail(
  libraryPath: string | null,
  playlistId: string | null,
) {
  return useQuery<PlaylistDetail | null, Error>({
    queryKey: ["playlist", libraryPath, playlistId],
    queryFn: () => getPlaylist(libraryPath!, playlistId!),
    enabled: libraryPath !== null && playlistId !== null,
    staleTime: Infinity,
  });
}
