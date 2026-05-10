# Status

## Current phase
Phase 1 — foundations & read-only library (target: v0.1.0)

## Current task
Scaffold `apps/desktop` — Tauri 2 + React + Vite + Tailwind. First-run wizard to locate `master.db` and validate it.

## Recently completed
- [x] Bootstrap: repo scaffold per §3 (session 1)
- [x] `crates/rekordbox-db`: SQLCipher read-only connection, track/playlist/cue queries, ANLZ beat-grid parser, 38 tests (session 2)
- [x] `crates/rekordbox-xml`: parse + emit Rekordbox XML, round-trip tests (session 3)
- [x] `crates/cache`: SQLite WAL store, schema versioning, sqlite-vec extension hook, audio-features upsert/query (session 3)

## Phase 1 checklist
- [x] Repo scaffold per §3
- [ ] CI: lint, test, build matrix (macOS, Windows)
- [x] `crates/rekordbox-db`: SQLCipher key derivation; open `master.db` read-only; queries; integration test
- [x] `crates/rekordbox-xml`: parse and emit Rekordbox XML; round-trip property tests
- [x] `crates/cache`: SQLite WAL store; schema versioning; load sqlite-vec extension
- [ ] `apps/desktop`: Tauri 2 scaffold, React + Vite + Tailwind. First-run wizard locates `master.db` and validates.
- [ ] Library browser UI: virtualized track table, filterable, sortable
- [ ] Track detail panel: tags, cues, waveform
- [ ] Audio preview: spacebar to play/pause, scrub on waveform
- [ ] Settings: theme, library path, model API keys
- [ ] **Demo:** open the app, see your library, click a track, hear it

## Blockers
None.
