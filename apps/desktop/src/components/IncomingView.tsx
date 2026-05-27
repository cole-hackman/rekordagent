import { useCallback, useEffect, useState } from "react";
import { TrackTable } from "./TrackTable";
import { useFilterContext } from "../hooks/useFilterContext";
import { EMPTY_FILTERS } from "../lib/filters";
import { useDialog } from "../hooks/useDialog";
import { useToast } from "./Toast";
import {
  archiveTracks,
  clearIncoming,
  listIncomingTracks,
} from "../ipc";
import type { Track } from "../types";

interface Props {
  libraryPath: string;
  selectedTrackIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSelect: (track: Track) => void;
  onTrackContextMenu?: (track: Track, anchor: { x: number; y: number }) => void;
}

export function IncomingView({
  libraryPath,
  selectedTrackIds,
  onSelectionChange,
  onSelect,
  onTrackContextMenu,
}: Props) {
  const dialog = useDialog();
  const { toast } = useToast();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { ctx: filterCtx } = useFilterContext(libraryPath);

  const refresh = useCallback(async () => {
    if (!libraryPath) return;
    setLoading(true);
    try {
      const rows = await listIncomingTracks(libraryPath);
      setTracks(rows);
    } catch (e) {
      toast({ variant: "error", message: "Failed to load incoming tracks", detail: String(e) });
    } finally {
      setLoading(false);
    }
  }, [libraryPath, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClear = async () => {
    if (tracks.length === 0) return;
    const ok = await dialog.confirm({
      title: `Clear incoming inbox?`,
      body: `Marks ${tracks.length} track(s) as reviewed. They will only reappear here if added again after this point.`,
      confirmLabel: "Clear",
    });
    if (!ok) return;
    await clearIncoming(libraryPath);
    onSelectionChange(new Set());
    await refresh();
  };

  const handleArchiveSelected = async () => {
    if (selectedTrackIds.size === 0) return;
    await archiveTracks(libraryPath, [...selectedTrackIds]);
    onSelectionChange(new Set());
    toast({ variant: "success", message: `Archived ${selectedTrackIds.size} track(s).` });
    await refresh();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-base animate-in fade-in duration-200">
      <header className="flex shrink-0 items-start justify-between border-b border-edge/60 px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Incoming</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {loading
              ? "Loading…"
              : `${tracks.length} new track${tracks.length === 1 ? "" : "s"} since you last cleared.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleArchiveSelected}
            disabled={selectedTrackIds.size === 0}
            className="rounded bg-elevated px-3 py-1 text-sm text-ink hover:bg-edge disabled:opacity-50"
          >
            Archive selected ({selectedTrackIds.size})
          </button>
          <button
            onClick={handleClear}
            disabled={tracks.length === 0}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-base hover:opacity-90 disabled:opacity-50"
          >
            Mark all reviewed
          </button>
        </div>
      </header>

      <TrackTable
        libraryPath={libraryPath}
        filters={EMPTY_FILTERS}
        filterCtx={filterCtx}
        selectedTrackIds={selectedTrackIds}
        onSelectionChange={onSelectionChange}
        onSelect={onSelect}
        onTrackContextMenu={onTrackContextMenu}
        tracksOverride={tracks}
      />
    </div>
  );
}
