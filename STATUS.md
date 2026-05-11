# Status

## Current phase
Phase 13 — local stdio MCP server implemented for external model hosts.

## Current task
Manual real-library verification remains the main release blocker. `master.db` writes are still prohibited.

## Verification baseline
- `cargo test --workspace`: passing as of 2026-05-11 (cues + playlists gained `track_ids_*` tests)
- `pnpm test`: passing as of 2026-05-11 (116 tests, +23 since previous pass)
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
- [x] Phase 12 — second UI polish pass: denser track table (28px rows, IBM Plex Mono numerics), labeled sidebar (168px, amber active rule), structured filter system with drawer + chips (BPM/year ranges, key/genre multi-select, missing-metadata toggles, has-cues, not-in-any-playlist, comment-contains), playlist duplicate badges + duplicate count, expanded playlist columns (health dot, genre, time, year), inspector empty state, always-visible Details toggle.
- [x] Two new read-only IPC commands: `list_tracks_with_cues`, `list_tracks_in_any_playlist`.
- [x] Confirmed playlist duplicates are real Rekordbox `djmdSongPlaylist` entries — surfaced via DUP badge, not deleted.
- [x] Shared `agent-tools` Rust service for provider-neutral tool execution.
- [x] `decks mcp` local stdio MCP server for Claude Code, Gemini CLI, and other local MCP hosts.
- [x] `decks tools call` diagnostic CLI for direct tool invocation.
- [ ] HTTP MCP transport for OpenAI Responses API remote MCP usage.

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
- Claude Code is detected locally. Subscription-backed Claude use is now supported through Claude Code as the MCP host; the embedded Tauri chat still uses Anthropic API keys.
