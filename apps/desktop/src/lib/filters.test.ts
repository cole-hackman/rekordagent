import { describe, it, expect } from "vitest";
import {
  applyFilters,
  EMPTY_FILTERS,
  activeFilterCount,
  distinctValues,
  isInboxTrack,
  trackMissesField,
  type FilterContext,
} from "./filters";
import type { Track } from "../types";

function track(partial: Partial<Track>): Track {
  return {
    id: "t",
    title: "Untitled",
    artist: null,
    album: null,
    genre: null,
    musical_key: null,
    bpm: null,
    duration_secs: null,
    rating: null,
    comment: null,
    folder_path: null,
    analysis_data_path: null,
    file_type: null,
    sample_rate: null,
    bit_rate: null,
    release_year: null,
    dj_play_count: null,
    ...partial,
  };
}

const CTX: FilterContext = {
  tracksWithCues: new Set(),
  tracksInAnyPlaylist: new Set(),
  tracksWithMissingFiles: new Set(),
};

describe("applyFilters", () => {
  const tracks = [
    track({ id: "1", title: "Dark Matter", artist: "Surgeon", bpm: 140, musical_key: "8A", genre: "Techno", release_year: 2014 }),
    track({ id: "2", title: "Acid Rain", artist: "Plastikman", bpm: 125, musical_key: "5A", genre: "Acid", release_year: 1993 }),
    track({ id: "3", title: "Force + Form", artist: null, bpm: 0, musical_key: null, genre: null, release_year: null, comment: "needs metadata" }),
    track({ id: "4", title: "Drop", artist: "Boys Noize", bpm: 128, musical_key: "5A", genre: "Techno", release_year: 2020, comment: "festival opener" }),
  ];

  it("returns everything with empty filters", () => {
    expect(applyFilters(tracks, EMPTY_FILTERS, CTX)).toHaveLength(4);
  });

  it("text query matches title, artist, comment", () => {
    expect(applyFilters(tracks, { ...EMPTY_FILTERS, query: "surgeon" }, CTX).map((t) => t.id)).toEqual(["1"]);
    expect(applyFilters(tracks, { ...EMPTY_FILTERS, query: "FESTIVAL" }, CTX).map((t) => t.id)).toEqual(["4"]);
  });

  it("BPM range is inclusive on both ends", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, bpmMin: 125, bpmMax: 130 }, CTX);
    expect(out.map((t) => t.id)).toEqual(["2", "4"]);
  });

  it("year range works", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, yearMin: 2000 }, CTX);
    expect(out.map((t) => t.id)).toEqual(["1", "4"]);
  });

  it("key multi-select", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, keys: ["5A"] }, CTX);
    expect(out.map((t) => t.id)).toEqual(["2", "4"]);
  });

  it("missing toggles intersect", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, missing: ["artist", "bpm"] }, CTX);
    expect(out.map((t) => t.id)).toEqual(["3"]);
  });

  it("comment substring is case-insensitive", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, commentContains: "OPENER" }, CTX);
    expect(out.map((t) => t.id)).toEqual(["4"]);
  });

  it("hasCues: yes / no uses the context set", () => {
    const ctx: FilterContext = { tracksWithCues: new Set(["1", "4"]), tracksInAnyPlaylist: new Set(), tracksWithMissingFiles: new Set() };
    expect(applyFilters(tracks, { ...EMPTY_FILTERS, hasCues: "yes" }, ctx).map((t) => t.id)).toEqual(["1", "4"]);
    expect(applyFilters(tracks, { ...EMPTY_FILTERS, hasCues: "no" }, ctx).map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("notInAnyPlaylist hides tracks present in the membership set", () => {
    const ctx: FilterContext = { tracksWithCues: new Set(), tracksInAnyPlaylist: new Set(["2", "3"]), tracksWithMissingFiles: new Set() };
    expect(applyFilters(tracks, { ...EMPTY_FILTERS, notInAnyPlaylist: true }, ctx).map((t) => t.id)).toEqual(["1", "4"]);
  });

  it("missingFiles restricts to tracks in the missing-files set", () => {
    const ctx: FilterContext = {
      tracksWithCues: new Set(),
      tracksInAnyPlaylist: new Set(),
      tracksWithMissingFiles: new Set(["3"]),
    };
    expect(
      applyFilters(tracks, { ...EMPTY_FILTERS, missingFiles: true }, ctx).map(
        (t) => t.id,
      ),
    ).toEqual(["3"]);
  });

  it("combined filters AND together", () => {
    const out = applyFilters(
      tracks,
      { ...EMPTY_FILTERS, bpmMin: 120, bpmMax: 130, keys: ["5A"] },
      CTX,
    );
    expect(out.map((t) => t.id)).toEqual(["2", "4"]);
  });

  it("treats bpm 0 as missing", () => {
    const out = applyFilters(tracks, { ...EMPTY_FILTERS, missing: ["bpm"] }, CTX);
    expect(out.map((t) => t.id)).toEqual(["3"]);
  });
});

describe("activeFilterCount", () => {
  it("returns 0 for empty filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it("does not count the query input", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: "hello" })).toBe(0);
  });

  it("counts each active filter once", () => {
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        bpmMin: 120,
        bpmMax: 130, // same group, counts once
        keys: ["5A"],
        missing: ["artist"],
        hasCues: "yes",
      }),
    ).toBe(4);
  });
});

describe("isInboxTrack", () => {
  // A "complete" track has all core metadata, is in a playlist, and has cues —
  // it should NOT be in the inbox.
  const complete = track({
    id: "complete",
    artist: "A",
    bpm: 128,
    musical_key: "8A",
    genre: "Techno",
  });
  const ctxComplete: FilterContext = {
    tracksWithCues: new Set(["complete"]),
    tracksInAnyPlaylist: new Set(["complete"]),
    tracksWithMissingFiles: new Set(),
  };

  it("excludes complete tracks", () => {
    expect(isInboxTrack(complete, ctxComplete)).toBe(false);
  });

  it("includes tracks not in any playlist", () => {
    const ctx: FilterContext = {
      ...ctxComplete,
      tracksInAnyPlaylist: new Set(),
    };
    expect(isInboxTrack(complete, ctx)).toBe(true);
  });

  it("includes tracks with no cues", () => {
    const ctx: FilterContext = {
      ...ctxComplete,
      tracksWithCues: new Set(),
    };
    expect(isInboxTrack(complete, ctx)).toBe(true);
  });

  it("includes tracks missing artist/bpm/key/genre individually", () => {
    for (const field of ["artist", "bpm", "musical_key", "genre"] as const) {
      const t = track({ ...complete, [field]: null });
      expect(isInboxTrack(t, ctxComplete)).toBe(true);
    }
  });

  it("treats bpm=0 as missing (so 0 bpm imported tracks land in inbox)", () => {
    const t = track({ ...complete, bpm: 0 });
    expect(isInboxTrack(t, ctxComplete)).toBe(true);
  });

  it("does NOT include tracks missing release_year (year isn't an inbox signal)", () => {
    const t = track({ ...complete, release_year: null });
    expect(isInboxTrack(t, ctxComplete)).toBe(false);
  });
});

describe("trackMissesField", () => {
  it("treats whitespace-only strings as missing", () => {
    expect(trackMissesField(track({ artist: "   " }), "artist")).toBe(true);
    expect(trackMissesField(track({ artist: "x" }), "artist")).toBe(false);
  });

  it("treats non-finite or non-positive numbers as missing", () => {
    expect(trackMissesField(track({ bpm: 0 }), "bpm")).toBe(true);
    expect(trackMissesField(track({ bpm: -1 }), "bpm")).toBe(true);
    expect(trackMissesField(track({ bpm: NaN }), "bpm")).toBe(true);
    expect(trackMissesField(track({ bpm: 128 }), "bpm")).toBe(false);
  });
});

describe("distinctValues", () => {
  it("returns distinct sorted non-empty values", () => {
    const tracks = [
      track({ genre: "Techno" }),
      track({ genre: "Acid" }),
      track({ genre: "Techno" }),
      track({ genre: null }),
      track({ genre: "  " }),
    ];
    expect(distinctValues(tracks, (t) => t.genre)).toEqual(["Acid", "Techno"]);
  });
});
