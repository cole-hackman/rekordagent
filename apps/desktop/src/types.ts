/**
 * Mirrors `rekordbox_db::types::CueKind` with serde external tagging:
 *   MemoryCue  → "MemoryCue"
 *   HotCue(n)  → { HotCue: n }
 */
export type CueKind = "MemoryCue" | { HotCue: number };

/** Mirrors `rekordbox_db::types::HotCue`. */
export interface HotCue {
  id: string;
  content_id: string;
  in_msec: number | null;
  out_msec: number | null;
  kind: CueKind;
  color: number | null;
  comment: string | null;
}

/** Mirrors `rekordbox_db::types::Playlist`. */
export interface Playlist {
  id: string;
  name: string;
  kind: "Playlist" | "Folder" | "SmartPlaylist" | { Unknown: number };
  parent_id: string | null;
  seq: number | null;
}

export interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
}

export interface DuplicateGroup {
  title: string;
  artist: string | null;
  tracks: Track[];
}

export interface BrokenMetadataReport {
  missing_artist: Track[];
  missing_bpm: Track[];
  missing_key: Track[];
  missing_genre: Track[];
  suspicious: Track[];
}

/** Mirrors `rekordbox_db::types::Track` (serde snake_case). */
export interface Track {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  musical_key: string | null;
  bpm: number | null;
  duration_secs: number | null;
  rating: number | null;
  comment: string | null;
  folder_path: string | null;
  analysis_data_path: string | null;
  file_type: number | null;
  sample_rate: number | null;
  bit_rate: number | null;
  release_year: number | null;
  dj_play_count: number | null;
}
