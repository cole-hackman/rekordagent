import { useQuery } from "@tanstack/react-query";
import { getTrackCues } from "../ipc";
import type { HotCue } from "../types";

export function useTrackCues(libraryPath: string | null, trackId: number | null) {
  return useQuery<HotCue[], Error>({
    queryKey: ["cues", libraryPath, trackId],
    queryFn: () => getTrackCues(libraryPath!, trackId!),
    enabled: libraryPath !== null && trackId !== null,
    staleTime: Infinity,
  });
}
