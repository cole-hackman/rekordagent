import type { ChangeEvent } from "react";
import {
  EMPTY_FILTERS,
  type Filters,
  type HasCues,
  type MissingField,
} from "../lib/filters";
import { MultiSelectDropdown } from "./ui/MultiSelectDropdown";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (next: Filters) => void;
  /** Distinct values from the loaded library for multi-selects. */
  availableKeys: string[];
  availableGenres: string[];
  /** Indicates that the on-disk missing-files scan is in flight. */
  missingFilesLoading?: boolean;
}

const MISSING_OPTIONS: { id: MissingField; label: string }[] = [
  { id: "artist", label: "Artist" },
  { id: "bpm", label: "BPM" },
  { id: "key", label: "Key" },
  { id: "genre", label: "Genre" },
  { id: "year", label: "Year" },
];

const HAS_CUES_OPTIONS: { id: HasCues; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "yes", label: "Has cues" },
  { id: "no", label: "No cues" },
];

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  availableKeys,
  availableGenres,
  missingFilesLoading = false,
}: Props) {
  if (!open) return null;

  const patch = (p: Partial<Filters>) => onChange({ ...filters, ...p });

  const toggleMissing = (field: MissingField) => {
    patch({
      missing: filters.missing.includes(field)
        ? filters.missing.filter((m) => m !== field)
        : [...filters.missing, field],
    });
  };

  const togglePill = (
    list: string[],
    value: string,
    set: (next: string[]) => void,
  ) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <aside
      role="dialog"
      aria-label="Filters"
      className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-edge bg-base shadow-2xl shadow-black/40 animate-[slideInRight_150ms_ease-out]"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">
          Filters
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
            className="text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:text-ink-secondary"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="rounded p-1 text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {/* BPM range */}
        <Section label="BPM">
          <div className="flex items-center gap-2">
            <NumberInput
              value={filters.bpmMin}
              placeholder="min"
              onChange={(v) => patch({ bpmMin: v })}
            />
            <span className="text-ink-faint">–</span>
            <NumberInput
              value={filters.bpmMax}
              placeholder="max"
              onChange={(v) => patch({ bpmMax: v })}
            />
          </div>
        </Section>

        {/* Year range */}
        <Section label="Year">
          <div className="flex items-center gap-2">
            <NumberInput
              value={filters.yearMin}
              placeholder="from"
              onChange={(v) => patch({ yearMin: v })}
            />
            <span className="text-ink-faint">–</span>
            <NumberInput
              value={filters.yearMax}
              placeholder="to"
              onChange={(v) => patch({ yearMax: v })}
            />
          </div>
        </Section>

        {/* Key multi-select */}
        {availableKeys.length > 0 && (
          <Section label="Key">
            <MultiSelectDropdown
              label="Keys"
              options={availableKeys}
              selected={filters.keys}
              onToggle={(v) =>
                togglePill(filters.keys, v, (next) => patch({ keys: next }))
              }
              onClear={() => patch({ keys: [] })}
              mono
            />
          </Section>
        )}

        {/* Genre multi-select */}
        {availableGenres.length > 0 && (
          <Section label="Genre">
            <MultiSelectDropdown
              label="Genres"
              options={availableGenres}
              selected={filters.genres}
              onToggle={(v) =>
                togglePill(filters.genres, v, (next) =>
                  patch({ genres: next }),
                )
              }
              onClear={() => patch({ genres: [] })}
            />
          </Section>
        )}

        {/* Missing metadata */}
        <Section label="Missing metadata">
          <div className="flex flex-wrap gap-1.5">
            {MISSING_OPTIONS.map((opt) => {
              const active = filters.missing.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleMissing(opt.id)}
                  className={[
                    "rounded-md border px-2 py-1 text-[11px] transition-colors duration-150",
                    active
                      ? "border-accent/60 bg-accent/10 text-accent-hover"
                      : "border-edge text-ink-secondary hover:border-edge-strong hover:text-ink",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Cues */}
        <Section label="Cue points">
          <div className="flex gap-1.5">
            {HAS_CUES_OPTIONS.map((opt) => {
              const active = filters.hasCues === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => patch({ hasCues: opt.id })}
                  className={[
                    "flex-1 rounded-md border px-2 py-1 text-[11px] transition-colors duration-150",
                    active
                      ? "border-accent/60 bg-accent/10 text-accent-hover"
                      : "border-edge text-ink-secondary hover:border-edge-strong hover:text-ink",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Playlist membership */}
        <Section label="Playlist membership">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-secondary">
            <input
              type="checkbox"
              checked={filters.notInAnyPlaylist}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                patch({ notInAnyPlaylist: e.target.checked })
              }
              className="h-3.5 w-3.5 rounded border-edge-strong bg-surface accent-accent"
            />
            Not in any playlist
          </label>
        </Section>

        {/* On-disk health */}
        <Section label="File health">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-secondary">
            <input
              type="checkbox"
              checked={filters.missingFiles}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                patch({ missingFiles: e.target.checked })
              }
              className="h-3.5 w-3.5 rounded border-edge-strong bg-surface accent-accent"
            />
            Missing files only
            {filters.missingFiles && missingFilesLoading && (
              <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border border-edge-strong border-t-accent-hover" />
            )}
          </label>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
            Tracks whose audio file no longer exists on disk. Scans the
            filesystem the first time it's enabled per library.
          </p>
        </Section>

        {/* Comment substring */}
        <Section label="Comment contains">
          <input
            type="text"
            value={filters.commentContains}
            onChange={(e) => patch({ commentContains: e.target.value })}
            placeholder="e.g. opener"
            className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </Section>
      </div>
    </aside>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </h3>
      {children}
    </section>
  );
}

function NumberInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => onChange(numOrNull(e.target.value))}
      placeholder={placeholder}
      className="w-full rounded-md border border-edge bg-surface px-2 py-1.5 text-center font-mono text-[12px] tabular-nums text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
    />
  );
}
