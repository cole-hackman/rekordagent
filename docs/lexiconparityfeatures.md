# Lexicon DJ Parity — Feature Specifications

This document describes seven features modelled after Lexicon DJ that should be
implemented in rekordagent. Use it as a design brief when planning each feature.

---

## Prerequisites & Shared Infrastructure

Before implementing any write-back feature (Genre Cleanup, Smart Fixes, Sync),
the following must be in place:

- **ChangeManager crate** — vendor `crates/changes` from the reklawdbox repo
  (`changes.rs`, ~1 640 LOC). Every mutation to `master.db` must go through
  `ChangeManager` so changes can be tracked, previewed, and exported.
- **Sidecar database** — a SQLite file at `~/.rekordagent/data.db` (or adjacent
  to `master.db`) for data that lives outside Rekordbox: custom tags, archived
  track list, incoming watermark, smart-fix config, field-mapping config.
- **Write-safety check** — before any `UPDATE`/`INSERT` on `master.db`, verify
  the file is not WAL-locked (Rekordbox is closed). Surface a clear error if it
  is. Create a timestamped backup on the first write of each session.

---

## Feature 1 — Custom Tags

### Overview

A tagging system that lives in the sidecar database. Users create named
categories (e.g. "Genre", "Mood", "Situation"), add free-text tags within each
category, and assign tags to tracks. Tags can be used to filter the track
browser and to create saved smart-lists.

### Data Model (sidecar DB)

```sql
CREATE TABLE tag_categories (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  seq       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES tag_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE track_tags (
  track_id TEXT NOT NULL,   -- Rekordbox djmdContent.ID
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, tag_id)
);
```

### Tauri Commands (Rust)

| Command | Signature | Notes |
|---|---|---|
| `list_tag_categories` | `(library_path) → Vec<TagCategory>` | |
| `create_tag_category` | `(name) → TagCategory` | generates UUID id |
| `rename_tag_category` | `(id, name)` | |
| `delete_tag_category` | `(id)` | cascades to tags + track_tags |
| `reorder_tag_categories` | `(ordered_ids: Vec<String>)` | update seq |
| `list_tags` | `(category_id?) → Vec<Tag>` | all tags or filtered |
| `create_tag` | `(category_id, name) → Tag` | |
| `rename_tag` | `(id, name)` | |
| `delete_tag` | `(id)` | |
| `move_tag` | `(id, new_category_id)` | |
| `reorder_tags` | `(category_id, ordered_ids)` | |
| `get_track_tags` | `(track_id) → Vec<Tag>` | |
| `set_track_tags` | `(track_id, tag_ids: Vec<String>)` | replace all |
| `add_track_tag` | `(track_id, tag_id)` | |
| `remove_track_tag` | `(track_id, tag_id)` | |
| `search_tracks_by_tags` | `(library_path, tag_ids, match_all: bool) → Vec<Track>` | |

### Agent Tools

- `tags__list_categories()` — list all categories + their tags
- `tags__search_tracks(tag_ids, match_all)` — filter library by tags
- `tags__set_track_tags(track_id, tag_ids)` — assign tags to a track

### UI

- **"Custom Tags" panel** — dedicated left-nav item
- Categories rendered as collapsible sections: `Name (N tags)` header with `+`
  / gear / `⋮` action buttons
- Tags rendered as draggable chips; drag between categories to move; drag within
  category to reorder
- Click chip = select; Cmd/Shift+click = multi-select; selected chips
  highlighted in accent colour
- Double-click chip = inline rename; right-click = context menu (Rename, Delete,
  Move to…)
- Usage count badge when > 0 tracks: `Mashup (5)`
- Bottom toolbar: "Filter tags…" search input · "Clear selection" · "Add
  category" · "Save as smartlist" · "Show tracks" (opens track browser filtered
  to selection)
- Pressing `T` in the track browser opens a tag-picker popover for the focused
  row

---

## Feature 2 — Genre Cleanup

### Overview

Reads all distinct `Genre` values from `djmdContent` with per-value track
counts. User selects one or more genre chips, types a new name, and clicks
Rename — this bulk-updates `Genre` on all affected rows via ChangeManager.
Artist Cleanup is identical but targets the `Artist` field.

### Tauri Commands (Rust)

| Command | Signature | Notes |
|---|---|---|
| `list_genres` | `(library_path) → Vec<{genre: String, count: u32}>` | sorted by count desc |
| `rename_genre` | `(library_path, old_genre, new_genre) → u32` | rows updated |
| `delete_genre` | `(library_path, genre) → u32` | sets field to NULL |
| `import_genres_as_tags` | `(library_path, genres: Vec<String>)` | creates "Genre" tag category |
| `list_artists` | `(library_path) → Vec<{artist: String, count: u32}>` | |
| `rename_artist` | `(library_path, old_artist, new_artist) → u32` | |
| `delete_artist` | `(library_path, artist) → u32` | |

All write commands go through ChangeManager and are recorded in the change log.

### UI

- Full-width chip cloud; each chip: `Genre Name (N)`, clickable pill button
- Shift+click selects a range; Cmd+click toggles individual chips
- Right-click: "Lock" (exclude from bulk ops), "Jump to in track browser"
- Bottom toolbar:
  - Search input (filters displayed chips)
  - "Import to Custom Tags" button
  - "New genre / artist" text field with autocomplete from existing values
  - "Delete" (red, destructive — clears field on all affected tracks)
  - "Rename" (green — renames / merges all selected values to the new field
    value)
- Warning dialog before writing: counts affected tracks, confirms Rekordbox
  is closed
- **Artist Cleanup** is a separate nav item using the same component with
  `field = "Artist"`

---

## Feature 3 — Smart Fixes

### Overview

A panel of one-click metadata cleanup operations. Each fix scans the library
(or a specific playlist), returns a preview of proposed changes, then applies
the selected changes via ChangeManager on confirmation.

### UX Pattern

1. User clicks a fix card to expand it (accordion)
2. "Scan" triggers a preview: table shows track · field · current value ·
   proposed value
3. User deselects unwanted rows
4. "Apply N changes" writes selected rows to `master.db`
5. Card shows "Last ran: [date]" after first use

### Fix Definitions

All fixes operate on `djmdContent` fields unless noted. Preview and apply are
separate commands for each fix.

#### Fix Casing
- Detect titles/artists that are `ALL CAPS` or `all lowercase`
- Apply Title Case (capitalise first letter of each word; lowercase articles /
  prepositions: a, an, the, and, but, or, in, on, at, to, for, of, with)
- Fields: Title, Artist, Album

#### Replace with Space
- Replace junk separators (`_`, `/`, `\`, `|`) with a single space
- Collapse multiple consecutive spaces; trim
- Configurable: user selects which characters to replace

#### Fix Encoded Characters
- HTML entities → plain text: `&amp;` → `&`, `&apos;` / `&#39;` → `'`,
  `&quot;` → `"`, `&lt;` → `<`, `&gt;` → `>`
- Windows-1252 mojibake patterns (smart quotes, em-dash misencoded as â€")
- Fields: Title, Artist, Album, Comment

#### Extract Artist from Title
- Target: tracks where Artist is empty/null but Title contains
  `"Artist - Title"` or `"Artist: Title"`
- Split on first ` - ` (with spaces) — left part → Artist, right part → Title
- Skip if Artist already populated

#### Extract Remixer
- Target: Title contains remix attribution but Remixer field is empty
- Patterns: `(X Remix)`, `[X Edit]`, `(X Re-Edit)`, `(X Bootleg)`
- Extracted name → Remixer field; Title updated to remove the redundant
  parenthetical if Remixer is now set

#### Remove Garbage
- Strip non-printable characters, null bytes, U+FFFD replacement chars
- Strip zero-width spaces, soft hyphens, directional marks (LRM/RLM)
- Normalise repeated punctuation: `!!!` → `!`
- Fields: Title, Artist, Album, Comment

#### Remove Promotional Text
- Case-insensitive scan across Title, Artist, Album, Comment for:
  `Free Download`, `FREE DL`, `[FREE]`, `(FREE)`, `Out Now`, `Available Now`,
  `Released`, `Buy Now`, `Exclusive`, `Promo`, `Beatport Exclusive`,
  `Juno Exclusive`, `WAV Download`, and common variations
- Remove the matched substring; strip empty brackets that result

#### Remove Number Prefix
- Pattern: `^\d{1,3}[\s.\-_)]+` at the start of a Title
- Examples: `"01. Song"` → `"Song"`, `"1 - Song"` → `"Song"`

#### Remove URLs
- Detect `http://…`, `https://…`, `www.…`, bare domains, and email addresses
  anywhere in any text field
- Remove URL and surrounding brackets/parentheses if the URL was the sole
  content inside them

#### Add Mix Parentheses
- Target: titles with remix/mix/edit attribution not enclosed in `()` or `[]`
- Wrap these suffixes when bare: `Original Mix`, `Extended Mix`, `Radio Edit`,
  `Club Mix`, `Dub Mix`, `Instrumental`, `Acapella`, `VIP`, `Bootleg`, and
  anything ending in ` Remix`, ` Edit`, ` Mix` at the end of the title
- Example: `"Song Original Mix"` → `"Song (Original Mix)"`

#### Remove Common Text
- User-configurable blocklist stored in sidecar DB
- Defaults: `(Official Audio)`, `(Official Video)`, `(Lyric Video)`,
  `(Music Video)`, `HD`, `HQ`, `4K`, `[Premiere]`,
  `Provided to YouTube by`, label boilerplate strings
- UI: editable list in a settings sub-panel

### Tauri Commands (Rust) — Unified API

```rust
smart_fix_preview(library_path: String, fix_name: String, playlist_id: Option<String>)
  -> Vec<FixProposal { id: String, track_id: String, field: String, old_value: String, new_value: String }>

smart_fix_apply(library_path: String, fix_name: String, proposal_ids: Vec<String>)
  -> u32  // count applied
```

`fix_name` values: `fix_casing`, `replace_with_space`, `fix_encoded_chars`,
`extract_artist`, `extract_remixer`, `remove_garbage`, `remove_promo`,
`remove_number_prefix`, `remove_urls`, `add_mix_parens`, `remove_common_text`

### Agent Tools

- `smart_fixes__preview(fix_name, playlist_id?)` — preview proposals
- `smart_fixes__apply(fix_name, proposal_ids)` — apply selected proposals

---

## Feature 4 — Sync / Write-back to Rekordbox

### Overview

After changes have accumulated in the ChangeManager log, the Sync panel lets
the user push those changes back into `master.db` so Rekordbox picks them up on
next launch.

### Sync Modes

| Mode | Behaviour |
|---|---|
| Full | Write all pending changes for all tracks |
| Playlist | Write changes only for tracks in a selected playlist |
| Modified | Write only tracks touched since the last sync |

### Options

| Option | Type | Description |
|---|---|---|
| Field mappings | Button → modal | Map rekordagent fields to Rekordbox columns (e.g. Custom Tag "Genre" → `Genre` column) |
| Convert keys | Dropdown | Original keys / Camelot / Open Key — transform the Key field format on write |
| Change to nearest color | Checkbox + color picker | Map any colour value to the nearest Rekordbox-supported colour (8 colours) |
| All smartlists to playlists | Checkbox | Materialise saved tag-filter smartlists as static Rekordbox playlists |
| Don't touch my grids | Checkbox | Skip writing BPM / beatgrid changes even if present in change log |
| Cue Destination | Dropdown | Write hot cues to: Cue slots (1–8) / Memory Cues / Both |

### Tauri Commands (Rust)

| Command | Signature | Notes |
|---|---|---|
| `sync_check` | `(library_path) → {locked: bool, pending_changes: u32}` | is DB writable? |
| `sync_preview` | `(library_path, mode, options) → Vec<PendingChange>` | staged diff before commit |
| `sync_execute` | `(library_path, mode, options) → SyncResult {tracks_written, errors}` | |
| `sync_import` | `(library_path)` | pull latest Rekordbox state (if user changed things in RB directly) |

### Staged Diff UI

Before executing, show a table: Track Title · Field · Old Value · New Value ·
☑ include checkbox. User can deselect individual changes. Scrollable, with
"Select all" / "Deselect all".

### Safety

- Detect WAL lock → show "Please close Rekordbox to continue" error inline
- Create a timestamped backup (`master.db.bak.YYYYMMDD-HHmmss`) before the
  first write of each session
- Backup path shown in confirmation dialog

---

## Feature 5 — Tracks Sub-views: Incoming & Archive

### Incoming

A "new arrivals" inbox showing tracks added since the user last cleared the
queue.

- Stored as `last_incoming_cleared_at` (ISO timestamp) in sidecar DB
- All tracks with `DateCreated > last_incoming_cleared_at` appear here
- Badge on nav item shows count of unreviewed tracks
- "Clear incoming" button advances `last_incoming_cleared_at` to now

Tauri commands: `list_incoming_tracks(library_path, since: String) → Vec<Track>`,
`clear_incoming(library_path)`

### Archive

A user-managed cold-storage list. Tracks remain in Rekordbox but are hidden
from the main browser by default.

- Stored in sidecar DB: `archived_tracks(track_id TEXT PK, archived_at TEXT)`
- Main track browser gains a "Show archived" toggle (off by default)

Tauri commands: `list_archived_tracks(library_path) → Vec<Track>`,
`archive_tracks(library_path, track_ids: Vec<String>)`,
`unarchive_tracks(track_ids: Vec<String>)`

### UI

- Both appear as sub-items under a collapsible "Tracks" section in the left nav
- Same `<TrackTable>` component reused; contextual right-click actions differ:
  - Incoming: "Mark as reviewed", "Archive"
  - Archive: "Unarchive", "Delete from library"

---

## Feature 6 — Genre Cleanup (already covered in Feature 2)

See Feature 2. Artist Cleanup is the same component parameterised on `field =
"Artist"` instead of `field = "Genre"`.

---

## Feature 7 — Track Matcher

### Overview

Given a list of track names from any external source, fuzzy-match them against
the local Rekordbox library and optionally create a playlist from the results.

### Input Sources

| Source | Method |
|---|---|
| Paste / text file | Freeform textarea or `.txt` upload, one track per line |
| CSV file | `.csv` upload with column-mapping step (which column = title, artist) |
| Spotify playlist | Public playlist URL → Spotify public API (Client ID stored in settings) |
| Tidal playlist | Tidal API (requires client credentials in settings) |
| Apple Music playlist | Apple Music API (requires Apple developer token in settings) |
| SoundCloud playlist | SoundCloud public API (no auth for public playlists) |
| YouTube playlist | YouTube Data API v3 or `yt-dlp --flat-playlist --dump-json` |

### Matching Algorithm (Rust)

1. **Normalise** both sides: lowercase, strip punctuation, remove `feat.`/`ft.`
   clauses, strip suffixes `(Original Mix)` / `(Extended)` / `(Radio Edit)`
2. **Exact match** on normalised `artist + title` concatenation
3. **Fuzzy match** on normalised title alone (token-sort Levenshtein ratio ≥ 85)
4. Return confidence score (0.0–1.0) and match status: `exact` / `fuzzy` /
   `unmatched`

### Tauri Commands (Rust)

| Command | Signature |
|---|---|
| `match_tracks` | `(library_path, candidates: Vec<{title, artist?}>) → Vec<MatchResult {input_title, input_artist?, track?, score, status}>` |
| `create_playlist_from_tracks` | `(library_path, name, track_ids) → playlist_id` |

`create_playlist_from_tracks` writes rows to `djmdPlaylist` and
`djmdSongPlaylist` via ChangeManager.

Frontend handles all external API calls (Spotify, YouTube, etc.) directly from
the WebView, since Tauri allows outbound HTTP. Store API keys/tokens in the
existing `get_api_key` / `set_api_key` keychain commands, keyed by service
name (`"spotify"`, `"youtube"`, `"apple_music"`, etc.).

### Agent Tool

- `library__match_tracks(candidates: [{title, artist?}])` — AI can identify
  which tracks from an external list exist in the library

### Results UI

- Two-column layout: "Input tracks" (left) | "Matched to" (right)
- Matched rows: green checkmark + local track info (title, artist, BPM, key)
- Fuzzy matches: yellow checkmark + confidence percentage
- Unmatched: orange dash + "Search manually" button (opens mini search popover)
- Summary bar: "42 / 50 tracks matched"
- "Create playlist" button (names it after the source, e.g. "Spotify – Chill
  Vibes")
- "Export unmatched" → downloads `.txt` of unmatched input lines

---

## Implementation Order

| Step | Feature | Blocker |
|---|---|---|
| 1 | Vendor ChangeManager (`crates/changes`) | Required by steps 2–4 |
| 2 | Genre Cleanup + Artist Cleanup | ChangeManager |
| 3 | Smart Fixes | ChangeManager |
| 4 | Custom Tags (sidecar DB) | None — fully independent |
| 5 | Tracks sub-views (Incoming + Archive) | Sidecar DB |
| 6 | Sync / Write-back panel | ChangeManager + staged diff |
| 7 | Track Matcher | None — read-only + external APIs |
| 8 | Enhanced track columns (KEY colours, ENERGY, CUSTOM chips) | Custom Tags (for CUSTOM column) |
