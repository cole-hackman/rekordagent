/** Mirrors `rekordbox_db::types::Track` (serde snake_case). */
export interface Track {
  id: number;
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
