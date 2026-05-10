import { useQuery } from "@tanstack/react-query";
import { listTracks } from "../ipc";
import type { Track } from "../types";

export function useLibrary(libraryPath: string | null) {
  return useQuery<Track[], Error>({
    queryKey: ["library", libraryPath],
    queryFn: () => listTracks(libraryPath!),
    enabled: libraryPath !== null,
    staleTime: Infinity,
  });
}
