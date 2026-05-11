# Status

## Current phase
Phase 10 — local macOS release build completed; Phase 11 UI audit documented.

## Current task
Manual real-library verification remains the main release blocker. `master.db` writes are still prohibited.

## Verification baseline
- `cargo test --workspace`: passing as of 2026-05-11
- `pnpm test`: passing as of 2026-05-11 (93 tests)
- `pnpm typecheck`: passing as of 2026-05-11
- `pnpm lint`: passing as of 2026-05-11
- `pnpm build`: passing as of 2026-05-11
- `pnpm e2e`: passing as of 2026-05-11 (4 Playwright tests)
- `pnpm --filter desktop tauri build`: passing as of 2026-05-11

## Current true implementation state
- [x] Repo scaffold, Cargo workspace, pnpm workspace, CI workflow.
- [x] `crates/rekordbox-db`: read-only SQLCipher connection, tracks, playlists, playlist entries, cues, ANLZ beat grid parser.
- [x] `crates/rekordbox-xml`: parse and emit Rekordbox XML with round-trip tests.
- [x] `crates/cache`: SQLite WAL cache with schema migrations and audio-feature cache.
- [x] Desktop app: Tauri 2, React, Vite, Tailwind, first-run library selection and validation.
- [x] Library UI: virtualized track table with filter and sort.
- [x] Track detail UI: metadata and cue display, with visible cue-load failures.
- [x] Audio preview: native rodio play/pause for selected track.
- [ ] Waveform rendering and scrub controls: deferred; current UI has a placeholder only.
- [x] Settings: theme, library path change, Anthropic API key in OS keychain, and Claude Code install/login/subscription detection.
- [x] Agent read-only MVP tools: search, get track, list playlists, get playlist, list cues, orphan scan, duplicate scan, broken metadata scan.
- [x] Playlist support: backend playlist detail tool and basic playlist panel UI.
- [x] Conversation persistence.
- [x] Safe staged changes and diff review.
- [x] Export accepted changes to Rekordbox XML.
- [x] One-click audit workflow entry point in the agent panel.
- [x] Playwright E2E tests.
- [ ] Real Rekordbox library manual verification.
- [x] macOS release build artifacts generated.
- [x] Final UI audit and redesign recommendations documented.
- [x] Implemented phase 11 UI polish (empty states, panel layout, zero values, placeholder waveform).
- [x] Deterministic synthetic fixture generator: `scripts/seed-test-library.sh`.
- [x] Playlist view fills available workspace height instead of a fixed short band.
- [x] Cue query supports additional real-library `djmdCue` column variants.

## MVP phase checklist
- [x] Phase 0 — Repo familiarization and status reconciliation.
- [ ] Phase 1 — Stabilize current foundation and tag `v0.1.0`. (Ready for manual verification)
- [x] Phase 2 — Define MVP agent and playlist scope.
- [x] Phase 3 — Implement missing read-only agent tools and playlist view.
- [x] Phase 4 — Persist conversations.
- [x] Phase 5 — Safe staged changes system.
- [x] Phase 6 — Inline diff review UI.
- [x] Phase 7 — XML export.
- [x] Phase 8 — One complete MVP workflow.
- [x] Phase 9 — Playwright E2E.
- [x] Phase 10 — Local macOS release build.
- [x] Phase 11 — Full UI audit and redesign suggestions.

## Blockers
- Real Rekordbox 7 `master.db` manual testing requires access to a local user library.
- Packaged app artifacts exist at `target/release/bundle/macos/decks.app` and `target/release/bundle/dmg/decks_0.1.0_aarch64.dmg`, but manual launch verification against a real/disposable library is still required.
- Claude Code is detected locally, but the in-app agent runtime still uses Anthropic API keys until a dedicated Claude Code adapter is implemented.
