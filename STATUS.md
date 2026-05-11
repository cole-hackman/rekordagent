# Status

## Current phase
Phase 0 — MVP reconciliation and source-of-truth docs.

## Current task
Make the project Markdown match the implementation, then proceed through the MVP plan in `docs/MVP_PLAN.md`.

## Verification baseline
- `cargo test --workspace`: passing as of 2026-05-11
- `pnpm test`: passing as of 2026-05-11 (71 tests)
- `pnpm typecheck`: passing as of 2026-05-11
- `pnpm lint`: passing as of 2026-05-11

## Current true implementation state
- [x] Repo scaffold, Cargo workspace, pnpm workspace, CI workflow.
- [x] `crates/rekordbox-db`: read-only SQLCipher connection, tracks, playlists, playlist entries, cues, ANLZ beat grid parser.
- [x] `crates/rekordbox-xml`: parse and emit Rekordbox XML with round-trip tests.
- [x] `crates/cache`: SQLite WAL cache with schema migrations and audio-feature cache.
- [x] Desktop app: Tauri 2, React, Vite, Tailwind, first-run library selection and validation.
- [x] Library UI: virtualized track table with filter and sort.
- [x] Track detail UI: metadata and cue display.
- [x] Audio preview: native rodio play/pause for selected track.
- [ ] Waveform rendering and scrub controls: deferred; current UI has a placeholder only.
- [x] Settings: theme, library path change, Anthropic API key in OS keychain.
- [~] Agent chat: streaming Claude loop with `library.search`, `library.list_playlists`, and `health.orphan_scan`.
- [~] Playlist support: backend can list playlists and entries; no dedicated playlist UI or playlist-detail agent tool yet.
- [ ] Conversation persistence.
- [ ] Safe staged changes and diff review.
- [ ] Export accepted changes to Rekordbox XML.
- [ ] Playwright E2E tests.
- [ ] Real Rekordbox library manual verification.
- [ ] macOS packaged app verification.
- [ ] Final UI audit and redesign recommendations.

## MVP phase checklist
- [~] Phase 0 — Repo familiarization and status reconciliation.
- [ ] Phase 1 — Stabilize current foundation and tag `v0.1.0`.
- [ ] Phase 2 — Define MVP agent and playlist scope.
- [ ] Phase 3 — Implement missing read-only agent tools and playlist view.
- [ ] Phase 4 — Persist conversations.
- [ ] Phase 5 — Safe staged changes system.
- [ ] Phase 6 — Inline diff review UI.
- [ ] Phase 7 — XML export.
- [ ] Phase 8 — One complete MVP workflow.
- [ ] Phase 9 — Playwright E2E.
- [ ] Phase 10 — Local macOS release build.
- [ ] Phase 11 — Full UI audit and redesign suggestions.

## Blockers
- Real Rekordbox 7 `master.db` manual testing requires access to a local user library.
- macOS packaged verification requires local signing/build prerequisites and manual app launch.
