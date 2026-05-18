import type { Filters, MissingField } from "../lib/filters";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

interface Chip {
  label: string;
  clear: () => void;
}

export function FilterChips({ filters, onChange }: Props) {
  const chips: Chip[] = [];

  if (filters.bpmMin !== null || filters.bpmMax !== null) {
    const lo = filters.bpmMin ?? "–";
    const hi = filters.bpmMax ?? "–";
    chips.push({
      label: `BPM ${lo}–${hi}`,
      clear: () => onChange({ ...filters, bpmMin: null, bpmMax: null }),
    });
  }
  if (filters.yearMin !== null || filters.yearMax !== null) {
    const lo = filters.yearMin ?? "–";
    const hi = filters.yearMax ?? "–";
    chips.push({
      label: `Year ${lo}–${hi}`,
      clear: () => onChange({ ...filters, yearMin: null, yearMax: null }),
    });
  }
  for (const k of filters.keys) {
    chips.push({
      label: `Key ${k}`,
      clear: () =>
        onChange({ ...filters, keys: filters.keys.filter((v) => v !== k) }),
    });
  }
  for (const g of filters.genres) {
    chips.push({
      label: `Genre ${g}`,
      clear: () =>
        onChange({
          ...filters,
          genres: filters.genres.filter((v) => v !== g),
        }),
    });
  }
  for (const m of filters.missing) {
    chips.push({
      label: `Missing ${m}`,
      clear: () =>
        onChange({
          ...filters,
          missing: filters.missing.filter((v) => v !== m) as MissingField[],
        }),
    });
  }
  if (filters.hasCues !== "any") {
    chips.push({
      label: filters.hasCues === "yes" ? "Has cues" : "No cues",
      clear: () => onChange({ ...filters, hasCues: "any" }),
    });
  }
  if (filters.notInAnyPlaylist) {
    chips.push({
      label: "Not in any playlist",
      clear: () => onChange({ ...filters, notInAnyPlaylist: false }),
    });
  }
  if (filters.missingFiles) {
    chips.push({
      label: "Missing files",
      clear: () => onChange({ ...filters, missingFiles: false }),
    });
  }
  if (filters.commentContains.trim().length > 0) {
    chips.push({
      label: `Comment "${filters.commentContains.trim()}"`,
      clear: () => onChange({ ...filters, commentContains: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-edge bg-base px-3 py-1.5">
      {chips.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={c.clear}
          className="group flex items-center gap-1 rounded-full border border-edge bg-elevated/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary transition-colors hover:border-accent/40 hover:text-ink"
        >
          <span>{c.label}</span>
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
            className="h-2.5 w-2.5 text-ink-muted group-hover:text-accent-hover"
          >
            <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
