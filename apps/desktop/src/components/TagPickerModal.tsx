import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  listTagCategories,
  listTags,
  addTrackTag,
  removeTrackTag,
} from "../ipc";
import type { TagCategory, Tag } from "../types";

interface Props {
  libraryPath: string;
  selectedTrackIds: Set<string>;
  tagsByTrack: Map<string, Set<string>>;
  onClose: () => void;
}

export function TagPickerModal({ libraryPath, selectedTrackIds, tagsByTrack, onClose }: Props) {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Record<string, Tag[]>>({});

  // Maps tagId to how many selected tracks have this tag
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const cats = await listTagCategories();
        const allTags = await listTags();
        const tagMap: Record<string, Tag[]> = {};
        cats.forEach(c => tagMap[c.id] = []);
        allTags.forEach(t => {
          if (!tagMap[t.category_id]) tagMap[t.category_id] = [];
          tagMap[t.category_id].push(t);
        });

        const counts: Record<string, number> = {};
        for (const tid of selectedTrackIds) {
          const bound = tagsByTrack.get(tid);
          if (!bound) continue;
          for (const tagId of bound) {
            counts[tagId] = (counts[tagId] || 0) + 1;
          }
        }

        if (mounted) {
          setCategories(cats);
          setTags(tagMap);
          setTagCounts(counts);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load tags for picker", e);
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [libraryPath, selectedTrackIds, tagsByTrack]);

  const toggleTag = async (tagId: string) => {
    const trackIds = Array.from(selectedTrackIds);
    const count = tagCounts[tagId] || 0;
    const isAll = count === trackIds.length;
    
    // If all have it, remove from all. Otherwise, add to all.
    const adding = !isAll;
    
    await Promise.all(
      trackIds.map(tid =>
        adding
          ? addTrackTag(libraryPath, tid, tagId)
          : removeTrackTag(libraryPath, tid, tagId)
      )
    );

    await queryClient.invalidateQueries({ queryKey: ["track-tags-map", libraryPath] });

    setTagCounts(prev => ({
      ...prev,
      [tagId]: adding ? trackIds.length : 0
    }));
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      className="m-auto rounded-xl border border-edge bg-base p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm focus:outline-none"
    >
      <div className="flex w-[400px] flex-col max-h-[600px]">
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-[14px] font-semibold">
            Assign Tags <span className="font-mono text-ink-muted">({selectedTrackIds.size} tracks)</span>
          </h2>
          <button onClick={handleClose} className="text-ink-muted hover:text-ink">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-edge-strong border-t-accent-hover" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center text-sm text-ink-muted">No custom tags created yet.</div>
          ) : (
            <div className="flex flex-col gap-6">
              {categories.map(cat => {
                const catTags = tags[cat.id] || [];
                if (catTags.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary">{cat.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {catTags.map(tag => {
                        const count = tagCounts[tag.id] || 0;
                        const isAll = count === selectedTrackIds.size;
                        const isSome = count > 0 && count < selectedTrackIds.size;
                        
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={[
                              "flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium transition-colors",
                              isAll ? "border-accent bg-accent text-base" : 
                              isSome ? "border-accent/50 bg-accent/20 text-accent-hover" :
                              "border-edge bg-surface text-ink hover:border-edge-strong hover:bg-elevated"
                            ].join(" ")}
                          >
                            <span>{tag.name}</span>
                            {isSome && <span className="text-[10px] opacity-70">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}