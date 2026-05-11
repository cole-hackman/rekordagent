# Status

## Current phase
Phase 2 — agent loop & MCP-equivalent toolset (target: v0.2.0)

## Current task
Phase 2: vendor `changes.rs`, expand agent tools (~50 total), playlist browser panel, staging diff UI.

## Recently completed
- [x] Bootstrap: repo scaffold per §3 (session 1)
- [x] `crates/rekordbox-db`: SQLCipher read-only connection, track/playlist/cue queries, ANLZ beat-grid parser, 38 tests (session 2)
- [x] `crates/rekordbox-xml`: parse + emit Rekordbox XML, round-trip tests (session 3)
- [x] `crates/cache`: SQLite WAL store, schema versioning, sqlite-vec extension hook (session 3)
- [x] `apps/desktop`: Tauri 2 + React + Vite + Tailwind scaffold; first-run wizard; 7 vitest tests (session 4)
- [x] Library browser UI: virtualized track table, sort/filter; 15 vitest tests (session 5)
- [x] Track detail panel: metadata grid, hot cues list, waveform placeholder; 24 vitest tests (session 6)
- [x] Audio preview: rodio AudioPlayer, spacebar play/pause; 41 vitest tests (session 7)
- [x] Settings page: dark/light theme, library path, API keys via OS keychain; 55 vitest tests (session 8)
- [x] Agent chat panel: streaming Claude API agentic loop, tool_use; 71 vitest tests (session 9)
- [x] Fix: TEXT IDs to match Rekordbox 7 schema (session 10)
- [x] Fix: icon RGBA, beforeDevCommand loop (session 10)
- [x] Feat: claude CLI subscription mode — no API key required (session 10)
- [x] **Waveform display**: WaveSurfer.js via Tauri asset protocol, cue markers (session 10)
- [x] **v0.1.0 tagged** — Phase 1 complete

## Phase 1 checklist ✅
- [x] Repo scaffold
- [x] `crates/rekordbox-db`
- [x] `crates/rekordbox-xml`
- [x] `crates/cache`
- [x] Tauri 2 scaffold + first-run wizard
- [x] Library browser UI
- [x] Track detail panel (tags, cues, **waveform**)
- [x] Audio preview (spacebar play/pause)
- [x] Settings (theme, library path, API keys)
- [x] Agent chat (streaming, tool_use)
- [x] **Tagged v0.1.0**

## Phase 2 checklist
- [ ] `crates/changes`: staged ChangeManager (vendor from reklawdbox `src/changes.rs`)
- [ ] `crates/scoring`: transition scoring + beam-search sequencer (vendor from reklawdbox)
- [ ] Expand agent tools to cover all docs/tools.md entries
- [ ] Playlist browser panel in the UI
- [ ] Inline diff view (accept/reject per staged change)
- [ ] XML export workflow
- [ ] Model picker (Claude / OpenAI / Ollama)
- [ ] Conversation persistence
- [ ] **Demo:** audit collection, review diff, export XML

## Blockers
None.
