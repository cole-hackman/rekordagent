# Status

## Current phase
QA-pass remediation (2026-05-17): fixed six functional bugs that evaded the green test suites — missing `stream_claude_code_chat` Tauri command (re-implemented), ANLZ path-join bug in intro-cue staging (two sites, now share `anlz::resolve_anlz_path` helper), wrong Claude model id (`claude-opus-4-5` → settings-driven, defaults to `claude-sonnet-4-6`), global spacebar handler that swallowed button activation (moved to shared `useKeyboardShortcuts` with button/link/role=button exclusions), `is_playing` never clearing at end of track (audio thread now emits `playback-ended` and clears state), and Relocate flow staging `old_value: null` instead of the original path (now stages real old path + invalidates library/missing-files queries). Manual real-library verification still the v0.1.0 blocker.

## Current task
Manual real-library verification — the data-layer half is now automated via `scripts/real-library-smoke.sh` (13/13 against `~/Library/Pioneer/rekordbox/master.db`, sha256 unchanged). What still requires a human at the UI: first-run wizard walkthrough, track-table scroll smoothness, column sort interaction, theme persistence across restarts, spacebar focus rules, Anthropic key keychain prompt, chat panel mount/unmount, and a fresh `pnpm --filter desktop tauri build` artefact. `master.db` writes are still prohibited.

## Verification baseline
- `cargo test --workspace`: passing as of 2026-05-17 (test count up after adding `claude_agent::parse_stream_line` parser tests and `anlz::resolve_anlz_path` regression tests)
- `cargo clippy --workspace --all-targets -- -D warnings`: clean as of 2026-05-17
- `pnpm test`: passing as of 2026-05-17 (139 tests — +5 for new `useKeyboardShortcuts` test, +1 for SettingsPanel model select, -1 stale spacebar test in `useAudioPlayer`)
- `pnpm typecheck`: passing as of 2026-05-17
- `pnpm lint`: passing as of 2026-05-17
- `pnpm build`: passing as of 2026-05-15
- `pnpm e2e`: passing as of 2026-05-15 (4 Playwright tests)
- `pnpm --filter desktop tauri build`: passing as of 2026-05-16 — fresh `target/release/bundle/dmg/decks_0.1.0_aarch64.dmg` (9.1 MB) and `target/release/bundle/macos/decks.app/Contents/MacOS/decks-desktop` (arm64 Mach-O). Info.plist reports CFBundleShortVersionString=0.1.0, CFBundleIdentifier=app.decks.desktop. Launch verification still pending.

## Current true implementation state
- [x] Repo scaffold, Cargo workspace, pnpm workspace, CI workflow.
- [x] `crates/rekordbox-db`: read-only SQLCipher connection, tracks, playlists, playlist entries, cues, ANLZ beat grid parser.
- [x] `crates/rekordbox-xml`: parse and emit Rekordbox XML with round-trip tests.
- [x] `crates/cache`: SQLite WAL cache with schema migrations and audio-feature cache.
- [x] Desktop app: Tauri 2, React, Vite, Tailwind, first-run library selection and validation.
- [x] Library UI: virtualized track table with filter and sort.
- [x] Track detail UI: metadata and cue display, with visible cue-load failures.
- [x] Audio preview: native rodio play/pause for selected track.
- [x] Waveform rendering and scrub controls: high-fidelity native Pioneer color waveform (Phase 17) plus interactive seek/playhead (Phase 21).
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
- [x] HTTP MCP transport for OpenAI Responses API remote MCP usage (`decks mcp-http --bind <addr>`).
- [x] `crates/stratum-dsp`: vendored DSP engine (BPM detection, key detection, beat-grid HMM) from reklawdbox.
- [x] `crates/audio-tags`: lofty-based tag read/write for MP3/FLAC/M4A/WAV (title, artist, album, genre, BPM, key, comment, year, duration).
- [x] `crates/audio-analysis`: Symphonia decode + stratum-dsp analyze + Camelot key conversion + `audio_features` cache integration.
- [x] Tauri commands: `read_audio_tags`, `analyze_track`, `write_audio_tags`.
- [x] Agent MCP tools: `library.read_file_tags`, `library.analyze_track`, `library.scan_and_propose_missing`.
- [x] Track inspector: "Analyze" button → analysis result section with BPM/key/confidence + "Propose correction" buttons.
- [x] Phase 14 — ElevenLabs UI integration: synthetic StaticWaveform behind cue markers (clearly labeled "preview" — real audio analysis still deferred), Message + Response components for chat bubbles, ShimmeringText for agent thinking state, Conversation + scroll button for the message list. Added `@/*` path alias, shadcn-compatible Tailwind/CSS-var aliases, and shadcn Button/Avatar primitives.
- [x] Phase 15 — Fixed Claude Code `stream-json` output format parsing bug in Rust backend. Sub-process text is now properly emitted and integrated via `useAgent` progressive chunking, making the local subscription-backed Claude Code chat fully operational.
- [x] Phase 16 — UI/UX Layout & Filtering Enhancements (implemented by Gemini agent): Collapsible sidebar nav, resizable inspector panel (Chat/Details), resizable table columns, inline column search filters, non-blocking filter drawer, searchable multi-select Radix UI dropdowns for Key/Genre, Cmd/Shift multi-select track selection with summary action bar, and a toggle to hide the playlist sidebar for more space.
- [x] Phase 17 — Native Pioneer Waveform Rendering (implemented by Gemini agent): Reverse-engineered ANLZ parser in Rust (`PWAV`, `PWV3`, `PWV4`, `PWV5`) and high-fidelity `<ColorWaveform>` Canvas component replacing the synthetic placeholder.
- [x] Phase 18 — Smart Missing File Relocation (implemented by Gemini agent): `relocate` crate with fuzzy filename matching (Levenshtein), exposed via `relocate.scan` agent tool and `<RelocateBanner>` bulk-fix UI.
- [x] Phase 19 — Analytics Dashboard (implemented by Gemini agent): Efficient SQLite backend aggregation and `recharts` frontend UI (`<AnalyticsView>`) for genre, BPM, and key distributions.
- [x] Phase 20 — Audio-Fingerprint Duplicates (implemented by Gemini agent): Chromagram 128-byte hash extraction via `stratum-dsp`, cached persistently, with Hamming-distance grouping for detecting true duplicate audio files.
- [x] Phase 21 — Audio Playback Scrubbing (implemented by Gemini agent): `rodio` seek wiring and active polling for interactive waveform clicking and playhead tracking.
- [x] Phase 22 — The Inbox Workflow & Bulk Cues (implemented by Gemini agent): Dedicated `InboxView` for tracks missing metadata/cues/playlists, and a bulk "Add Intro Cues" tool that parses ANLZ beat grids to calculate mathematically perfect 1.1 downbeats and 4-bar loops.
- [x] Post-Gemini remediation (2026-05-15): finished the missing `library_stage_intro_cues` Tauri command + `Relocate*` enum variants the Gemini sessions left dangling, added unit tests for intro-cue logic and synthetic ANLZ PWAV/PWV3/PWV4/PWV5 parsers, added `PlaylistRemoveTrack` / `PlaylistDelete` export tests, added `audio_fingerprints` migration test, and removed dead `health__audio_fingerprint_scan` UI plumbing that called an unimplemented Tauri command. Removed the unfinished `SetBuilderView.tsx` Phase 3 stub (out-of-scope, didn't typecheck).

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
- Real Rekordbox 7 `master.db` manual testing requires access to a local user library. **Data-layer portion is now automated** — see `scripts/real-library-smoke.sh` (13/13 against the real library at `~/Library/Pioneer/rekordbox/master.db` on 2026-05-16, sha256 unchanged; covers `library_search`, `library_get_track`, `library_list_playlists`, `library_get_playlist`, `library_list_cues`, all four health scans, `staging_list_changes`, `library_read_file_tags` and (opt-in) `library_analyze_track`). UI-only items still need a human.
- Packaged app artifacts rebuilt fresh on 2026-05-16 at `target/release/bundle/macos/decks.app` and `target/release/bundle/dmg/decks_0.1.0_aarch64.dmg`; bundle structure verified (Info.plist OK, arm64 Mach-O binary present). Manual launch verification against a real/disposable library is still required.
- Claude Code is detected locally. Subscription-backed Claude use is now supported through Claude Code as the MCP host; the embedded Tauri chat still uses Anthropic API keys.
