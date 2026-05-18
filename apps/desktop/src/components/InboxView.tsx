import { useMemo, useState } from "react";
import { TrackTable } from "./TrackTable";
import { FilterChips } from "./FilterChips";
import { RelocateBanner } from "./RelocateBanner";
import { useLibrary } from "../hooks/useLibrary";
import { useFilterContext } from "../hooks/useFilterContext";
import { EMPTY_FILTERS, type Filters, applyFilters, isInboxTrack } from "../lib/filters";
import type { Track } from "../types";

interface Props {
  libraryPath: string;
  selectedTrackIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSelect: (track: Track) => void;
}

export function InboxView({
  libraryPath,
  selectedTrackIds,
  onSelectionChange,
  onSelect,
}: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { data: tracks = [] } = useLibrary(libraryPath);
  const { ctx: filterCtx } = useFilterContext(libraryPath);

  // 1. Filter down to ONLY inbox tracks.
  const inboxTracks = useMemo(() => {
    return tracks.filter(t => isInboxTrack(t, filterCtx));
  }, [tracks, filterCtx]);

  // 2. Apply any active user filters on top of the inbox tracks.
  const filteredInboxTracks = useMemo(
    () => applyFilters(inboxTracks, filters, filterCtx),
    [inboxTracks, filters, filterCtx],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-base animate-in fade-in duration-200">
      <header className="shrink-0 border-b border-edge/60 px-6 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Inbox
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Tracks that need your attention. These are missing metadata, cues, or haven't been added to a playlist.
        </p>
      </header>

      <FilterChips filters={filters} onChange={setFilters} />
      
      {filters.missingFiles && (
        <RelocateBanner libraryPath={libraryPath} />
      )}
      
      <TrackTable
        libraryPath={libraryPath}
        filters={filters}
        filterCtx={filterCtx}
        selectedTrackIds={selectedTrackIds}
        onSelectionChange={onSelectionChange}
        onSelect={onSelect}
        // We override the data inside TrackTable by passing a specialized tracks array, 
        // but TrackTable fetches its own data.
        // Let's modify TrackTable to accept a `tracksOverride` prop.
        tracksOverride={filteredInboxTracks}
      />
    </div>
  );
}
