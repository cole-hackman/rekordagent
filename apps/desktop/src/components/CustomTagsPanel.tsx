import { useEffect, useState } from "react";
import {
  listTagCategories,
  createTagCategory,
  listTags,
  createTag,
  deleteTag,
} from "../ipc";
import type { TagCategory, Tag } from "../types";
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

export function CustomTagsPanel() {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Record<string, Tag[]>>({});
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      const cats = await listTagCategories();
      setCategories(cats);
      
      const allTags = await listTags();
      const tagMap: Record<string, Tag[]> = {};
      cats.forEach(c => tagMap[c.id] = []);
      allTags.forEach(t => {
        if (!tagMap[t.category_id]) tagMap[t.category_id] = [];
        tagMap[t.category_id].push(t);
      });
      setTags(tagMap);
    } catch (e) {
      console.error("Failed to load tags", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCategory = async () => {
    const name = prompt("Enter category name:");
    if (name) {
      await createTagCategory(name);
      await loadData();
    }
  };

  const handleAddTag = async (categoryId: string) => {
    const name = prompt("Enter tag name:");
    if (name) {
      await createTag(categoryId, name);
      setExpandedCats(new Set(expandedCats).add(categoryId));
      await loadData();
    }
  };

  const toggleCat = (id: string) => {
    const next = new Set(expandedCats);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCats(next);
  };

  return (
    <div className="flex h-full flex-col bg-surface p-4 text-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Custom Tags</h2>
        <button
          onClick={handleAddCategory}
          className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs font-medium text-base hover:bg-accent-hover"
        >
          <PlusIcon className="h-3 w-3" />
          Category
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {categories.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-ink-muted">
            No tag categories found.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((cat) => {
              const isExpanded = expandedCats.has(cat.id);
              const catTags = tags[cat.id] || [];
              return (
                <div key={cat.id} className="rounded-md border border-edge bg-base p-2">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 font-medium text-ink"
                      onClick={() => toggleCat(cat.id)}
                    >
                      {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                      {cat.name}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddTag(cat.id)}
                        className="text-ink-muted hover:text-accent"
                        title="Add tag"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-2 pl-6">
                      {catTags.length === 0 ? (
                        <div className="text-xs text-ink-faint">No tags.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {catTags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex items-center gap-1 rounded bg-elevated px-2 py-1 text-xs text-ink"
                            >
                              <span>{tag.name}</span>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete tag ${tag.name}?`)) {
                                    await deleteTag(tag.id);
                                    await loadData();
                                  }
                                }}
                                className="ml-1 text-ink-faint hover:text-red-500"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}