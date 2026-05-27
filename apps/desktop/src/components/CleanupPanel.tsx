import { useCallback, useEffect, useState } from "react";
import {
  listGenres,
  listArtists,
  renameGenre,
  renameArtist,
  deleteGenre,
  deleteArtist,
} from "../ipc";
import { useDialog } from "../hooks/useDialog";
import { useToast } from "./Toast";

interface Props {
  mode: "genre" | "artist";
  libraryPath: string;
  onGoToSync?: () => void;
}

export function CleanupPanel({ mode, libraryPath, onGoToSync }: Props) {
  const dialog = useDialog();
  const { toast } = useToast();

  const [items, setItems] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      if (mode === "genre") {
        const res = await listGenres(libraryPath);
        setItems(res.map((g) => ({ name: g.genre, count: g.count })));
      } else {
        const res = await listArtists(libraryPath);
        setItems(res.map((a) => ({ name: a.artist, count: a.count })));
      }
    } catch (e) {
      toast({ variant: "error", message: `Failed to load ${mode}s`, detail: String(e) });
    }
  }, [mode, libraryPath, toast]);

  useEffect(() => {
    loadData();
    setSelectedItems(new Set());
  }, [loadData]);

  const handleToggle = (name: string, multi: boolean) => {
    const next = new Set(multi ? selectedItems : []);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedItems(next);
  };

  const afterStage = (totalTracks: number) => {
    if (totalTracks === 0) {
      toast({ variant: "info", message: "No tracks matched; nothing staged." });
      return;
    }
    toast({
      variant: "success",
      message: `Staged ${totalTracks} change(s).`,
      detail: "Review and apply in the Sync panel.",
      action: onGoToSync
        ? { label: "Review & Sync", onClick: onGoToSync }
        : undefined,
    });
  };

  const handleRename = async () => {
    if (selectedItems.size === 0) return;
    const newName = await dialog.prompt({
      title: `Rename ${selectedItems.size} ${mode}${selectedItems.size === 1 ? "" : "s"}`,
      body: `Selected: ${[...selectedItems].slice(0, 6).join(", ")}${
        selectedItems.size > 6 ? "…" : ""
      }`,
      placeholder: `New ${mode} name`,
      confirmLabel: "Stage rename",
    });
    if (!newName) return;

    let totalTracks = 0;
    for (const name of selectedItems) {
      const res =
        mode === "genre"
          ? await renameGenre(libraryPath, name, newName)
          : await renameArtist(libraryPath, name, newName);
      totalTracks += res.affected_tracks;
    }
    afterStage(totalTracks);
    await loadData();
    setSelectedItems(new Set());
  };

  const handleDelete = async () => {
    if (selectedItems.size === 0) return;
    const ok = await dialog.confirm({
      title: `Stage deletion of ${selectedItems.size} ${mode}${selectedItems.size === 1 ? "" : "s"}?`,
      body: `This clears the ${mode} field on every matching track. Nothing is written to master.db until you apply in the Sync panel.`,
      confirmLabel: "Stage deletion",
      destructive: true,
    });
    if (!ok) return;

    let totalTracks = 0;
    for (const name of selectedItems) {
      const res =
        mode === "genre"
          ? await deleteGenre(libraryPath, name)
          : await deleteArtist(libraryPath, name);
      totalTracks += res.affected_tracks;
    }
    afterStage(totalTracks);
    await loadData();
    setSelectedItems(new Set());
  };

  return (
    <div className="flex h-full flex-col bg-surface p-4 text-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-ink">{mode} Cleanup</h2>
        <div className="flex gap-2">
          {onGoToSync && (
            <button
              onClick={onGoToSync}
              className="rounded bg-elevated px-3 py-1 text-ink hover:bg-edge"
            >
              Review & Sync →
            </button>
          )}
          <button
            disabled={selectedItems.size === 0}
            onClick={handleRename}
            className="rounded bg-elevated px-3 py-1 font-medium text-ink hover:bg-edge disabled:opacity-50"
          >
            Rename
          </button>
          <button
            disabled={selectedItems.size === 0}
            onClick={handleDelete}
            className="rounded bg-red-500/10 px-3 py-1 font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-edge bg-base p-4">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-ink-muted">
            No {mode}s found.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const isSelected = selectedItems.has(item.name);
              return (
                <button
                  key={item.name}
                  onClick={(e) => handleToggle(item.name, e.shiftKey || e.metaKey)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "bg-accent text-base"
                      : "bg-elevated text-ink hover:bg-edge"
                  }`}
                >
                  <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                  <span className={`tabular-nums ${isSelected ? "text-base/80" : "text-ink-muted"}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
