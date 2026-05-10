# Status

## Current phase
Phase 1 — foundations & read-only library (target: v0.1.0)

## Current task
Scaffold `crates/rekordbox-db` — SQLCipher key derivation; open `master.db` read-only; query tracks, playlists, hot cues, beat grid; integration test against `fixtures/tiny-library/`.

## Recently completed
- [x] Bootstrap: repo scaffold per §3 of CLAUDE_CODE_PROMPT.md (session 1)

## Phase 1 checklist
- [x] Repo scaffold per §3
- [ ] CI: lint, test, build matrix (macOS, Windows)
- [ ] `crates/rekordbox-db`: SQLCipher key derivation; open `master.db` read-only; queries; integration test
- [ ] `crates/rekordbox-xml`: parse and emit Rekordbox XML; round-trip property tests
- [ ] `crates/cache`: SQLite WAL store; schema versioning; load sqlite-vec extension
- [ ] `apps/desktop`: Tauri 2 scaffold, React + Vite + Tailwind. First-run wizard locates `master.db` and validates.
- [ ] Library browser UI: virtualized track table, filterable, sortable
- [ ] Track detail panel: tags, cues, waveform
- [ ] Audio preview: spacebar to play/pause, scrub on waveform
- [ ] Settings: theme, library path, model API keys
- [ ] **Demo:** open the app, see your library, click a track, hear it

## Blockers
None.
