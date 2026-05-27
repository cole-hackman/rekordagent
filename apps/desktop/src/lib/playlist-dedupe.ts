import type { Track } from "../types";

export interface DuplicateInfo {
  /** Total occurrence count per track id (across the whole playlist). */
  occurrenceCount: Map<string, number>;
  /**
   * Occurrence rank per row index in the playlist:
   *   1 = first time the track appears
   *   2 = second occurrence
   *   etc.
   * Rows with rank ≥ 2 are duplicate-occurrences.
   */
  duplicateRanks: Map<number, number>;
  /** Number of rows whose rank is ≥ 2. */
  duplicateRowCount: number;
}

/**
 * Inspect a playlist's tracks array and report duplicate occurrences.
 *
 * Rekordbox's `djmdSongPlaylist` table can legitimately contain the same
 * track multiple times in one playlist (one row per entry, ordered by
 * TrackNo). We DO NOT remove these — they are real user intent. This
 * function surfaces them so the UI can badge the second+ occurrences and
 * show a duplicate count in the playlist header.
 */
export function findDuplicates(tracks: Track[]): DuplicateInfo {
  const occurrenceCount = new Map<string, number>();
  for (const t of tracks) {
    occurrenceCount.set(t.id, (occurrenceCount.get(t.id) ?? 0) + 1);
  }

  const duplicateRanks = new Map<number, number>();
  const seenSoFar = new Map<string, number>();
  let duplicateRowCount = 0;
  tracks.forEach((t, index) => {
    const next = (seenSoFar.get(t.id) ?? 0) + 1;
    seenSoFar.set(t.id, next);
    duplicateRanks.set(index, next);
    if (next >= 2) duplicateRowCount += 1;
  });

  return { occurrenceCount, duplicateRanks, duplicateRowCount };
}
