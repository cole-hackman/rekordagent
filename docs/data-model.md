# Data Model

> Living document — update in the same commit as the code it describes.

## Source of truth

The user's Rekordbox 7 `master.db` (SQLCipher-encrypted SQLite) is the primary source of truth for the library. We never write to it (until Phase 6 opt-in). Our `cache` SQLite database stores derived data (audio features, embeddings, change log, conversation history).

## Core types (to be defined in `crates/rekordbox-db`)

### Track
- `id: u64` — Rekordbox internal ID
- `title: String`
- `artist: String`
- `album: Option<String>`
- `genre: Option<String>`
- `bpm: Option<f64>`
- `key: Option<String>` — Camelot wheel notation
- `duration_ms: u64`
- `file_path: String`
- `date_added: NaiveDate`
- `rating: u8` — 0–5

### Playlist
- `id: u64`
- `name: String`
- `parent_id: Option<u64>`
- `track_ids: Vec<u64>`

### HotCue
- `track_id: u64`
- `index: u8` — 0-based slot
- `position_ms: u64`
- `color: Option<u32>` — RGB
- `name: Option<String>`
- `kind: HotCueKind` — `Cue | Loop | FadeIn | FadeOut | Load | Jump`

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

### Change
A staged mutation (tag edit, playlist change, etc.); pending until exported or rejected.
