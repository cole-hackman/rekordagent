# Status

## Current phase
Phase 1 — foundations & read-only library (target: v0.1.0)

## Current task
Audio preview: spacebar to play/pause selected track, scrub on waveform.

## Recently completed
- [x] Bootstrap: repo scaffold per §3 (session 1)
- [x] `crates/rekordbox-db`: SQLCipher read-only connection, track/playlist/cue queries, ANLZ beat-grid parser, 38 tests (session 2)
- [x] `crates/rekordbox-xml`: parse + emit Rekordbox XML, round-trip tests (session 3)
- [x] `crates/cache`: SQLite WAL store, schema versioning, sqlite-vec extension hook, audio-features upsert/query (session 3)
- [x] `apps/desktop`: Tauri 2 + React + Vite + Tailwind scaffold; first-run wizard (file picker → validate → persist); 7 vitest tests; pnpm typecheck + lint green (session 4)
- [x] Library browser UI: virtualized track table (TanStack Table + Virtual); title/artist/BPM/key/time/genre columns; header sort; filter input; 15 vitest tests (session 5)
- [x] Track detail panel: metadata grid, hot cues list (slot/timestamp/comment), waveform placeholder, row selection in table; 24 vitest tests (session 6)

## Phase 1 checklist
- [x] Repo scaffold per §3
- [ ] CI: lint, test, build matrix (macOS, Windows)
- [x] `crates/rekordbox-db`: SQLCipher key derivation; open `master.db` read-only; queries; integration test
- [x] `crates/rekordbox-xml`: parse and emit Rekordbox XML; round-trip property tests
- [x] `crates/cache`: SQLite WAL store; schema versioning; load sqlite-vec extension
- [x] `apps/desktop`: Tauri 2 scaffold, React + Vite + Tailwind. First-run wizard locates `master.db` and validates.
- [x] Library browser UI: virtualized track table, filterable, sortable
- [x] Track detail panel: tags, cues, waveform
- [ ] Audio preview: spacebar to play/pause, scrub on waveform
- [ ] Settings: theme, library path, model API keys
- [ ] **Demo:** open the app, see your library, click a track, hear it

## Blockers
None.
