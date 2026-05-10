# Journal

## Session 1 — 2026-05-10

### Plan
- Bootstrap the repo per §12 of CLAUDE_CODE_PROMPT.md (session 1 = STATUS.md absent).
- Goals:
  1. Create the full directory scaffold from §3.
  2. Set up Cargo workspace, pnpm workspace, CI, and toolchain pin.
  3. Create STATUS.md, JOURNAL.md, DECISIONS.md, and empty docs stubs.
- End state: `chore: bootstrap repo` committed and pushed; STATUS.md set to phase 1 / next task = "scaffold rekordbox-db crate".

### End of session
- Shipped: full repo scaffold per §3. Cargo workspace with 14 placeholder crates, pnpm workspace, CI workflow (fmt + clippy + test on macOS + Windows), rust-toolchain.toml, LICENSE (MIT), NOTICE (reklawdbox attribution), DECISIONS.md (ADR-0001 Tauri v2), and empty docs stubs.
- Next: scaffold `crates/rekordbox-db` — SQLCipher key derivation, open master.db read-only, query tracks/playlists/cues/beat grid, integration test against fixtures/tiny-library/.
- Blockers: none.

## Session 2 — 2026-05-10

### Plan
- Task: implement `crates/rekordbox-db` per STATUS.md.
- Goals:
  1. Fix Cargo.toml workspace (remove invalid `edition` key from `[workspace]`; switch rusqlite to `bundled-sqlcipher-vendored-openssl`).
  2. Implement `RekordboxDb` — read-only open with `PRAGMA key` (key = `402fd482...`), `busy_timeout`.
  3. Implement queries: tracks (with artist/album/genre/key JOINs), playlists, playlist entries, hot cues from `djmdCue`.
  4. Implement ANLZ beat grid parser (PQTZ binary tag, big-endian, 8-byte beat entries).
  5. Create synthetic SQLCipher test fixture; write integration test covering all query paths + error paths.
  6. Ensure `cargo clippy -- -D warnings` and `cargo test --workspace` pass.
- Key facts from research:
  - SQLCipher key: `402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497` (universal RB6/7)
  - `BPM` column: integer × 100 (12800 → 128.00 bpm); `Length`: seconds
  - `djmdCue.Kind`: 0 = memory cue, else hot cue slot number (1–8)
  - Beat grid in ANLZ `.DAT` file, PQTZ section; entries are big-endian {beat_num:u16, tempo_bpm×100:u16, time_ms:u32}

### End of session
- Shipped:
  - `crates/rekordbox-db` fully implemented: `RekordboxDb` (read-only open, PRAGMA key + busy_timeout), track queries with JOIN to artist/album/genre/key (BPM converted from int×100), playlist + playlist-entry queries, hot-cue queries from `djmdCue`, ANLZ beat-grid parser for PQTZ binary sections.
  - 38 tests: 21 unit tests (tracks, playlists, cues, ANLZ, connection safety) + 16 integration tests against a synthetic SQLCipher fixture + 1 doc-test.
  - Fixed workspace Cargo.toml (`edition` key removed; rusqlite moved out of workspace deps to per-crate with `bundled-sqlcipher-vendored-openssl`).
  - `cargo clippy -- -D warnings` and `cargo test --workspace` all pass.
  - Bug fixed mid-session: ANLZ parser `parse_pqtz_section` had wrong byte offset for `content_start` (was jumping 12 extra bytes into beat entries). Fixed by passing `section_start` directly and computing offsets from it.
- Next: implement `crates/rekordbox-xml` — parse and emit Rekordbox XML; round-trip property tests.
- Blockers: none.

## Session 3 — 2026-05-10

### Plan
- Task: implement `crates/rekordbox-xml` — parse and emit Rekordbox XML.
- Goals:
  1. Model `Collection`, `Track`, `Playlist`, `Position_Mark` (hot cue) types.
  2. Parse from XML using `quick-xml`; emit back to XML.
  3. Round-trip property test: parse → emit → parse, all fields equal.
  4. Unit tests: happy path track/playlist/cue parse + emit; malformed XML errors.
  5. Commit mid-session after first green test run; commit again at end.

### End of session
- Shipped:
  - `crates/rekordbox-xml`: full parse/emit for Rekordbox XML — `Collection`, `Track`, `Tempo`, `PositionMark`, `Node` (folder/playlist) types; `roxmltree` DOM parser; `quick-xml` writer with 2-space indentation; `file://localhost` URI helpers (`path_to_location` / `location_to_path`).
  - Round-trip tests: full collection, special chars in name (ampersand, angle brackets), empty collection, BPM precision at 128.0 / 174.5 / 100.123.
  - Bug fixed: `quick-xml` `push_attribute` escapes internally — removed manual `xml_escape()` call that caused double-escaping (`&amp;` → `&amp;amp;`).
  - `crates/cache`: SQLite WAL cache with schema migrations (`PRAGMA user_version`), `CacheDb` with `open` / `open_in_memory` / `load_vec_extension` (unsafe, Phase 4) / `upsert_audio_features` / `get_audio_features`. 10 tests all pass.
  - STATUS.md updated: rekordbox-xml and cache checked off; next task = apps/desktop Tauri 2 scaffold.
- Next: scaffold `apps/desktop` — Tauri 2 + React + Vite + Tailwind; first-run wizard to locate `master.db` and validate it.
- Blockers: none.

## Session 4 — 2026-05-10

### Plan
- Task: implement first-run wizard in `apps/desktop`.
- Goals:
  1. Add `tauri-plugin-dialog` (native file picker) and `tauri-plugin-store` (persisting library path) to both Cargo and package.json.
  2. Implement Tauri IPC commands: `validate_library_path(path)` (open with RekordboxDb, run test query), `get_library_path()`, `set_library_path(path)`.
  3. React `FirstRunWizard`: multi-step — welcome → pick file → validate → done.
  4. `App.tsx` shows wizard when no library path is stored; shows main layout when configured.
  5. Vitest tests for wizard component; pnpm typecheck + lint green; commit + push.

### End of session
- Shipped:
  - `apps/desktop/src-tauri/src/lib.rs`: three IPC commands — `validate_library_path` (opens RekordboxDb, queries track count), `get_library_path` (reads `~/.config/decks/config.json`), `set_library_path` (writes config).
  - `tauri-plugin-dialog` added to Cargo + npm; `src-tauri/capabilities/default.json` grants `core:default` + `dialog:allow-open`.
  - `src/ipc.ts`: typed wrappers for all IPC calls + `pickLibraryPath` using `@tauri-apps/plugin-dialog`.
  - `src/store/appStore.ts`: Zustand store with `libraryPath`, `trackCount`, `setLibraryConfigured`.
  - `src/components/FirstRunWizard.tsx`: 5-step wizard (welcome → pick → validating → done / error). Native file dialog, spinner, error retry.
  - `src/App.tsx`: on mount reads saved path, validates; shows spinner → wizard (unconfigured) or main layout (configured).
  - 7 vitest tests all pass; `pnpm typecheck` and `pnpm lint` both clean.
  - Fixed ESLint version conflict (upgraded from 8→9 to match typescript-eslint@8 requirements).
  - Note: Rust `cargo check` for `decks-desktop` requires `libwebkit2gtk-4.1-dev` and `libgtk-3-dev` on Linux — unavailable in this build environment due to package mirror 404s. Build verified on macOS/Windows as primary targets per spec (§1: "macOS first, Windows second, Linux best-effort").
- Next: Library browser UI — virtualized track table (TanStack Table + TanStack Virtual), filterable, sortable. Requires `list_tracks` IPC command.
- Blockers: none.

## Session 5 — 2026-05-10

### Plan
- Task: library browser UI — virtualized track table, filterable, sortable.
- Goals:
  1. Add `list_tracks(path)` Tauri IPC command (opens RekordboxDb, returns all tracks via spawn_blocking).
  2. `src/types.ts`: TypeScript Track type mirroring the Rust struct.
  3. `src/hooks/useLibrary.ts`: TanStack Query hook caching the track list.
  4. `src/components/TrackTable.tsx`: TanStack Table + TanStack Virtual; columns title/artist/BPM/key/duration/genre; header-click sort; filter text input.
  5. Update App.tsx main layout; wrap app in QueryClientProvider.
  6. Tests; pnpm typecheck + lint green; commit + push.

### End of session
- Shipped:
  - `src-tauri/src/lib.rs`: `list_tracks(path)` IPC command — opens RekordboxDb, returns all tracks via `tauri::async_runtime::spawn_blocking` (non-blocking on the JS side).
  - `src/types.ts`: TypeScript `Track` interface mirroring the Rust struct (snake_case serde output).
  - `src/ipc.ts`: added `listTracks()` wrapper.
  - `src/hooks/useLibrary.ts`: TanStack Query hook — `queryKey: ["library", libraryPath]`, `staleTime: Infinity` (load once, no refetch).
  - `src/main.tsx`: wrapped with `QueryClientProvider`.
  - `src/components/TrackTable.tsx`: TanStack Table + TanStack Virtual; columns: Title (280px), Artist (180px), BPM (72px, 1dp), Key (60px), Time (64px, M:SS), Genre (130px); header-click sort (asc/desc/none); client-side text filter on title/artist/album/genre; virtualizer renders only visible rows (ROW_H=36px, overscan=20).
  - `src/App.tsx`: replaced placeholder with filter input in header + `<TrackTable>` in main area.
  - 15 vitest tests (8 TrackTable + 6 FirstRunWizard + 1 App) all pass; `pnpm typecheck` + `pnpm lint` clean.
  - Virtualizer mock pattern documented: `useVirtualizer` returns all items in jsdom so row content is testable.
- Next: Track detail panel — show tags, hot cues list when a row is clicked. Requires `get_track_cues(id)` IPC command.
- Blockers: none.

## Session 6 — 2026-05-10

### Plan
- Task: track detail panel — show metadata and hot cues when a row is clicked.
- Goals:
  1. `get_track_cues(path, track_id)` Tauri IPC command via spawn_blocking.
  2. `HotCue` / `CueKind` TypeScript types; `getTrackCues` IPC wrapper; `useTrackCues` hook.
  3. `TrackDetailPanel`: title/artist/metadata grid, hot cues list (slot, timestamp, comment), waveform placeholder.
  4. `TrackTable`: add `onSelect` prop + row click handler + selected row highlight.
  5. `App.tsx`: `selectedTrack` state; split layout (table | panel).
  6. Vitest tests; typecheck + lint green; commit + push.

### End of session
- Shipped:
  - `src-tauri/src/lib.rs`: `get_track_cues(path, track_id)` IPC command via spawn_blocking.
  - `src/types.ts`: `CueKind` ("MemoryCue" | { HotCue: n }) and `HotCue` interface.
  - `src/ipc.ts`: `getTrackCues` wrapper.
  - `src/hooks/useTrackCues.ts`: TanStack Query hook (staleTime=Infinity, enabled when both args non-null).
  - `src/components/TrackDetailPanel.tsx`: 320px right panel — title/artist header, waveform placeholder, metadata grid (album/genre/BPM/key/duration/rating★/year/plays/comment), cue list sorted by in_msec (slot badge with per-slot color, M:SS.s timestamp, cue comment).
  - `src/components/TrackTable.tsx`: added `selectedTrackId` + `onSelect` props; selected row highlighted indigo; row click fires onSelect.
  - `src/App.tsx`: `selectedTrack` state; split body layout (table | detail panel when track selected).
  - 24 vitest tests pass; `pnpm typecheck` + `pnpm lint` clean.
- Next: Audio preview — spacebar to play/pause selected track, scrub on waveform. Requires `play_audio(path)` / `pause_audio` IPC commands using rodio on the Rust side.
- Blockers: none.
