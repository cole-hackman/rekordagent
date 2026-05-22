import type { Track } from "../types";

export type MissingField = "artist" | "bpm" | "key" | "genre" | "year";
export type HasCues = "any" | "yes" | "no";

export interface Filters {
  /** Free-text search across title/artist/album/genre/comment/path. */
  query: string;
  bpmMin: number | null;
  bpmMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  /** Multi-select. Empty array = no constraint. */
  keys: string[];
  genres: string[];
  missing: MissingField[];
  hasCues: HasCues;
  notInAnyPlaylist: boolean;
  /** Restrict to tracks whose `folder_path` does not exist on disk. */
  missingFiles: boolean;
  commentContains: string;
}

export interface FilterContext {
  tracksWithCues: Set<string>;
  tracksInAnyPlaylist: Set<string>;
  /** IDs of tracks whose audio file is missing on disk. Lazy — empty until
   *  the user enables the `missingFiles` filter. */
  tracksWithMissingFiles: Set<string>;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  bpmMin: null,
  bpmMax: null,
  yearMin: null,
  yearMax: null,
  keys: [],
  genres: [],
  missing: [],
  hasCues: "any",
  notInAnyPlaylist: false,
  missingFiles: false,
  commentContains: "",
};

const STORAGE_KEY = "decks.filters.v1";

/** Restore previously-persisted filter state. Always returns a value, even on
 *  parse failure. `query` and `missingFiles` are deliberately reset so reloads
 *  don't strand the user inside a heavy scan or a stale search term. */
export function loadPersistedFilters(): Filters {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw) as Partial<Filters>;
    return {
      ...EMPTY_FILTERS,
      ...parsed,
      query: "",
      missingFiles: false,
    };
  } catch {
    return EMPTY_FILTERS;
  }
}

export function persistFilters(filters: Filters): void {
  if (typeof window === "undefined") return;
  try {
    const { query: _query, missingFiles: _missingFiles, ...rest } = filters;
    void _query;
    void _missingFiles;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // Storage may be full or disabled — silent fail is fine.
  }
}

/** Number of non-query filters currently active. The query input is shown
 *  in the header separately, so it isn't counted here. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.bpmMin !== null || f.bpmMax !== null) n += 1;
  if (f.yearMin !== null || f.yearMax !== null) n += 1;
  if (f.keys.length > 0) n += 1;
  if (f.genres.length > 0) n += 1;
  if (f.missing.length > 0) n += 1;
  if (f.hasCues !== "any") n += 1;
  if (f.notInAnyPlaylist) n += 1;
  if (f.missingFiles) n += 1;
  if (f.commentContains.trim().length > 0) n += 1;
  return n;
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return !Number.isFinite(value) || value <= 0;
  return false;
}

function trackMatchesQuery(t: Track, q: string): boolean {
  if (!q) return true;
  return (
    t.title.toLowerCase().includes(q) ||
    (t.artist?.toLowerCase().includes(q) ?? false) ||
    (t.album?.toLowerCase().includes(q) ?? false) ||
    (t.genre?.toLowerCase().includes(q) ?? false) ||
    (t.comment?.toLowerCase().includes(q) ?? false) ||
    (t.folder_path?.toLowerCase().includes(q) ?? false)
  );
}

export function trackMissesField(t: Track, field: MissingField): boolean {
  switch (field) {
    case "artist":
      return isMissing(t.artist);
    case "bpm":
      return isMissing(t.bpm);
    case "key":
      return isMissing(t.musical_key);
    case "genre":
      return isMissing(t.genre);
    case "year":
      return isMissing(t.release_year);
  }
}

/**
 * Returns true if a track belongs in the "Inbox" (needs attention).
 * A track needs attention if it is not in any playlist, has no cues,
 * or is missing core metadata (artist, bpm, key, genre).
 */
export function isInboxTrack(t: Track, ctx: FilterContext): boolean {
  if (!ctx.tracksInAnyPlaylist.has(t.id)) return true;
  if (!ctx.tracksWithCues.has(t.id)) return true;
  if (trackMissesField(t, "artist")) return true;
  if (trackMissesField(t, "bpm")) return true;
  if (trackMissesField(t, "key")) return true;
  if (trackMissesField(t, "genre")) return true;
  return false;
}

/**
 * Apply the full filter stack to a list of tracks. Pure function — no side
 * effects, no IO. Pass a `FilterContext` with pre-computed sets for the
 * filters that need cross-track data.
 */
export function applyFilters(
  tracks: Track[],
  filters: Filters,
  ctx: FilterContext,
): Track[] {
  const q = filters.query.trim().toLowerCase();
  const comment = filters.commentContains.trim().toLowerCase();
  const keys = filters.keys.length > 0 ? new Set(filters.keys) : null;
  const genres = filters.genres.length > 0 ? new Set(filters.genres) : null;
  const missing = filters.missing;

  return tracks.filter((t) => {
    if (!trackMatchesQuery(t, q)) return false;

    if (filters.bpmMin !== null && (t.bpm ?? 0) < filters.bpmMin) return false;
    if (filters.bpmMax !== null && (t.bpm ?? Infinity) > filters.bpmMax)
      return false;

    if (filters.yearMin !== null && (t.release_year ?? 0) < filters.yearMin)
      return false;
    if (
      filters.yearMax !== null &&
      (t.release_year ?? Infinity) > filters.yearMax
    )
      return false;

    if (keys && (t.musical_key === null || !keys.has(t.musical_key)))
      return false;
    if (genres && (t.genre === null || !genres.has(t.genre))) return false;

    if (missing.length > 0) {
      // ALL specified missing-field toggles must hold (intersection).
      for (const field of missing) {
        if (!trackMissesField(t, field)) return false;
      }
    }

    if (filters.hasCues === "yes" && !ctx.tracksWithCues.has(t.id))
      return false;
    if (filters.hasCues === "no" && ctx.tracksWithCues.has(t.id)) return false;

    if (filters.notInAnyPlaylist && ctx.tracksInAnyPlaylist.has(t.id))
      return false;

    if (filters.missingFiles && !ctx.tracksWithMissingFiles.has(t.id))
      return false;

    if (comment && !(t.comment?.toLowerCase().includes(comment) ?? false))
      return false;

    return true;
  });
}

/** Collect distinct sorted values for a column across the loaded tracks.
 *  Used to populate the key/genre multi-select. */
export function distinctValues(
  tracks: Track[],
  pick: (t: Track) => string | null,
): string[] {
  const set = new Set<string>();
  for (const t of tracks) {
    const v = pick(t);
    if (v !== null && v !== undefined && v.trim().length > 0) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
