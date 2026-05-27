import { useCallback, useEffect, useState } from "react";
import { TrackTable } from "./TrackTable";
import { useFilterContext } from "../hooks/useFilterContext";
import { EMPTY_FILTERS } from "../lib/filters";
import { useToast } from "./Toast";
import { listArchivedTracks, stageTrackDelete, unarchiveTracks } from "../ipc";
import { useDialog } from "../hooks/useDialog";
import type { Track } from "../types";

interface Props {
  libraryPath: string;
  selectedTrackIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSelect: (track: Track) => void;
  onTrackContextMenu?: (track: Track, anchor: { x: number; y: number }) => void;
  onGoToSync?: () => void;
}

export function ArchiveView({
  libraryPath,
  selectedTrackIds,
  onSelectionChange,
  onSelect,
  onTrackContextMenu,
  onGoToSync,
}: Props) {
  const { toast } = useToast();
  const dialog = useDialog();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { ctx: filterCtx } = useFilterContext(libraryPath);

  const refresh = useCallback(async () => {
    if (!libraryPath) return;
    setLoading(true);
    try {
      const rows = await listArchivedTracks(libraryPath);
      setTracks(rows);
    } catch (e) {
      toast({ variant: "error", message: "Failed to load archive", detail: String(e) });
    } finally {
      setLoading(false);
    }
  }, [libraryPath, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUnarchive = async () => {
    if (selectedTrackIds.size === 0) return;
    await unarchiveTracks(libraryPath, [...selectedTrackIds]);
    toast({ variant: "success", message: `Unarchived ${selectedTrackIds.size} track(s).` });
    onSelectionChange(new Set());
    await refresh();
  };

  const handleDeleteFromLibrary = async () => {
    if (selectedTrackIds.size === 0) return;
    const count = selectedTrackIds.size;
    const ok = await dialog.confirm({
      title: `Delete ${count} track${count === 1 ? "" : "s"} from library?`,
      body: "Stages a soft-delete (sets rb_local_deleted = 1 on master.db). Nothing is written until you apply in the Sync panel. This cannot be undone from rekordagent.",
      confirmLabel: "Stage delete",
      destructive: true,
    });
    if (!ok) return;
    const staged = await stageTrackDelete(libraryPath, [...selectedTrackIds]);
    toast({
      variant: "success",
      message: `Staged ${staged} delete(s).`,
      detail: "Review and apply in the Sync panel.",
      action: onGoToSync ? { label: "Review & Sync", onClick: onGoToSync } : undefined,
    });
    onSelectionChange(new Set());
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-base animate-in fade-in duration-200">
      <header className="flex shrink-0 items-start justify-between border-b border-edge/60 px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Archive</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {loading
              ? "Loading…"
              : `${tracks.length} archived track${tracks.length === 1 ? "" : "s"}. Hidden from the main library by default.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteFromLibrary}
            disabled={selectedTrackIds.size === 0}
            className="rounded bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50"
          >
            Delete from library
          </button>
          <button
            onClick={handleUnarchive}
            disabled={selectedTrackIds.size === 0}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-base hover:opacity-90 disabled:opacity-50"
          >
            Unarchive ({selectedTrackIds.size})
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
