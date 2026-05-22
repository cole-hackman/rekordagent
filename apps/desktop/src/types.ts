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

export interface LibraryAnalytics {
  total_tracks: number;
  genre_distribution: Record<string, number>;
  bpm_histogram: Record<number, number>;
  key_distribution: Record<string, number>;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface ArtistCount {
  artist: string;
  count: number;
}

export interface TagCategory {
  id: string;
  name: string;
  seq: number;
}

export interface Tag {
  id: string;
  category_id: string;
  name: string;
  seq: number;
}

/** Mirrors `audio_tags::TrackTags`. */
export interface TrackTags {
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  bpm: number | null;
  musical_key: string | null;
  comment: string | null;
  year: number | null;
  rating: number | null;
  duration_secs: number | null;
  file_type: string | null;
}

/** Mirrors `audio_tags::TagWriteFields`. */
export interface TagWriteFields {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  genre?: string | null;
  bpm?: number | null;
  musical_key?: string | null;
  comment?: string | null;
  year?: number | null;
}

/** Mirrors `audio_analysis::AnalysisResult`. */
export interface AnalysisResult {
  bpm: number;
  musical_key: string;
  confidence: number;
  bpm_confidence: number;
  key_confidence: number;
  cached: boolean;
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

export interface BeatGridEntry {
  beat_number: number;
  tempo_bpm_x100: number;
  time_ms: number;
}

export type WaveformColor =
  | { type: "Blue"; value: number }
  | { type: "Rgb"; value: [number, number, number] };

export interface PreviewPoint {
  height: number;
  color: WaveformColor;
}

export interface DetailPoint {
  height: number;
  color: WaveformColor;
}

export interface AnlzWaveform {
  preview: PreviewPoint[];
  detail: DetailPoint[];
  beat_grid: BeatGridEntry[];
  peaks: number[] | null;
}

export interface RelocateMatch {
  path: string;
  score: number;
  reasons: string[];
}

export interface RelocateCandidate {
  track_id: string;
  original_path: string;
  matches: RelocateMatch[];
}

export interface TransitionScore {
  score: number;
  reasons: string[];
}
