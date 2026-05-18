import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  listTracksWithCues,
  listTracksInAnyPlaylist,
  listTracksWithMissingFiles,
} from "../ipc";
import type { FilterContext } from "../lib/filters";

/**
 * Library-wide lookups used by the filter system. Cached per library path;
 * the user manually refreshes by changing libraries or restarting the app.
 *
 * `enableMissingFiles` lazy-loads the on-disk existence check — it scans every
 * track's `folder_path` against the filesystem, which is expensive on large
 * libraries, so we only run it once the user enables the filter.
 */
export function useFilterContext(
  libraryPath: string | null,
  enableMissingFiles = false,
): {
  ctx: FilterContext;
  isLoading: boolean;
  missingFilesLoading: boolean;
} {
  const cues = useQuery<string[], Error>({
    queryKey: ["tracks-with-cues", libraryPath],
    queryFn: () => listTracksWithCues(libraryPath!),
    enabled: libraryPath !== null,
    staleTime: Infinity,
  });

  const inPlaylist = useQuery<string[], Error>({
    queryKey: ["tracks-in-any-playlist", libraryPath],
    queryFn: () => listTracksInAnyPlaylist(libraryPath!),
    enabled: libraryPath !== null,
    staleTime: Infinity,
  });

  const missingFiles = useQuery<string[], Error>({
    queryKey: ["tracks-with-missing-files", libraryPath],
    queryFn: () => listTracksWithMissingFiles(libraryPath!),
    enabled: libraryPath !== null && enableMissingFiles,
    staleTime: Infinity,
  });

  const ctx = useMemo<FilterContext>(
    () => ({
      tracksWithCues: new Set(cues.data ?? []),
      tracksInAnyPlaylist: new Set(inPlaylist.data ?? []),
      tracksWithMissingFiles: new Set(missingFiles.data ?? []),
    }),
    [cues.data, inPlaylist.data, missingFiles.data],
  );

  return {
    ctx,
    isLoading: cues.isLoading || inPlaylist.isLoading,
    missingFilesLoading: missingFiles.isLoading || missingFiles.isFetching,
  };
}
