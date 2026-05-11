# Data Model

> Living document — update in the same commit as the code it describes.

## Source of truth

The user's Rekordbox 7 `master.db` (SQLCipher-encrypted SQLite) is the primary source of truth for the library. We never write to it (until Phase 6 opt-in). Our `cache` SQLite database stores derived data (audio features, embeddings, change log, conversation history).

## Core types (`crates/rekordbox-db`)

### Track
- `id: String` — Rekordbox internal ID; Rekordbox 7 schemas can expose IDs as text
- `title: String`
- `artist: Option<String>`
- `album: Option<String>`
- `genre: Option<String>`
- `musical_key: Option<String>` — Camelot wheel notation when present
- `bpm: Option<f64>` — converted from DB integer × 100
- `duration_secs: Option<i64>`
- `folder_path: Option<String>`
- `analysis_data_path: Option<String>`
- `rating: Option<i64>` — Rekordbox rating value
- `comment: Option<String>`
- `file_type: Option<i64>`
- `sample_rate: Option<i64>`
- `bit_rate: Option<i64>`
- `release_year: Option<i64>`
- `dj_play_count: Option<i64>`

### Playlist
- `id: String`
- `name: String`
- `parent_id: Option<String>`
- `seq: Option<i64>`
- `kind: PlaylistKind` — `Playlist | Folder | SmartPlaylist | Unknown(i64)`

### PlaylistEntry
- `playlist_id: String`
- `content_id: String`
- `track_no: Option<i64>`

### HotCue / Memory Cue
- `id: String`
- `content_id: String`
- `in_msec: Option<i64>`
- `out_msec: Option<i64>`
- `kind: CueKind` — `MemoryCue | HotCue(u8)`
- `color: Option<i64>` — Rekordbox color ID; `-1` means unset
- `comment: Option<String>`

### BeatGrid
- `track_id: u64`
- `entries: Vec<BeatGridEntry>`

### BeatGridEntry
- `beat: u32`
- `position_ms: u64`
- `bpm: f64`

## Cache types (to be defined in `crates/cache`)

### AudioFeatures
Derived from audio analysis; cached per (track_id, analyzer_version).

### Embedding
512-d CLAP vector; cached per (track_id, model_version, chunking_config).

### Conversation
Persisted agent conversation, messages, tool calls, and tool results. Planned for the MVP conversation persistence phase.

### Change
A staged mutation such as a track metadata edit, cue metadata edit, or playlist mutation. Planned changes remain pending until the user accepts/rejects them; accepted changes are exported to Rekordbox XML and never written directly to `master.db`.
