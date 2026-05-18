# Rekordagent Full Working MVP Implementation Plan

> Source-of-truth checklist for getting `decks` from the current working foundation to a coherent MVP.

## MVP Definition

A user can install/open the macOS app, connect a Rekordbox 7 library read-only, browse tracks and playlists, ask the agent read-only questions, run one audit workflow, review proposed safe changes as diffs, accept/reject changes, and export accepted changes as Rekordbox XML. `master.db` is never directly mutated.

## Phase Checklist

- [x] Phase 0 — Repo familiarization and status reconciliation.
- [ ] Phase 1 — Stabilize current foundation and tag `v0.1.0`.
- [x] Phase 2 — Define MVP agent and playlist scope.
- [x] Phase 3 — Implement missing read-only agent tools and playlist view.
- [x] Phase 4 — Conversation persistence.
- [x] Phase 5 — Safe staged changes system.
- [x] Phase 6 — Inline diff review UI.
- [x] Phase 7 — XML export.
- [x] Phase 8 — One complete MVP workflow.
- [x] Phase 9 — Playwright E2E.
- [x] Phase 10 — Local macOS release build.
- [x] Phase 11 — Full UI audit and redesign suggestions.

## Phase 0 — Repo Familiarization + Status Reconciliation

- [x] Read project Markdown and ignore dependency Markdown under `node_modules`.
- [x] Inspect relevant Rust crates, Tauri commands, frontend components/hooks, agent files, tests, and docs.
- [x] Run current verification suite.
- [x] Update `STATUS.md` with true current state.
- [x] Update `README.md` to distinguish implemented and planned features.
- [x] Update `docs/data-model.md` and `docs/tools.md` for string Rekordbox IDs and MVP tool scope.
- [x] Create `docs/MANUAL_TEST_PLAN.md`.
- [x] Create `docs/UI_AUDIT.md`.

## Phase 1 — Stabilize Current Foundation / `v0.1.0`

- [ ] Run `cargo test --workspace`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run the app against a real Rekordbox 7 `master.db`.
- [ ] Verify first-run selection, track count, search/filter, selection, cue display, audio preview, settings persistence, key save/remove, and existing chat tools.
- [ ] Add regression tests for any real-library schema/path/audio issue.
- [ ] Document that waveform rendering and scrub controls are deferred from `v0.1.0`.
- [ ] Complete `docs/releases/v0.1.0.md`.
- [ ] Tag `v0.1.0` only after the manual checklist passes.

## Phase 2 — Define MVP Agent + Playlist Scope

- [x] Confirm MVP read-only tools: `library.search`, `library.get_track`, `library.list_playlists`, `library.get_playlist`, `library.list_cues`, `health.orphan_scan`, `health.duplicate_scan`, `health.broken_link_scan`.
- [x] Confirm playlist UX: list/sidebar, playlist track view, playlist search/filter, agent playlist questions, issue detection.
- [x] Confirm playlist mutations are staged only and never direct DB writes.
- [x] Update docs if implementation changes the tool contracts.

## Phase 3 — Missing Read-Only Agent Tools

- [x] Add Rust/Tauri commands for missing tool calls.
- [x] Add TypeScript IPC wrappers and type fixes.
- [x] Expand agent schemas and tool result payloads.
- [x] Render useful tool result summaries in chat.
- [x] Add playlist list/detail UI.
- [x] Add Rust and Vitest coverage.

## Phase 4 — Conversation Persistence

- [x] Add cache migrations for conversations, messages, and tool calls/results.
- [x] Add Tauri conversation CRUD commands.
- [x] Add frontend active conversation state and minimal selector UI.
- [x] Persist library association, timestamps, roles, content blocks, tool inputs, and results.
- [x] Add cache and frontend tests.

## Phase 5 — Safe Staged Changes System

- [x] Implement `crates/changes` lifecycle and types.
- [x] Persist staged changes in cache DB.
- [x] Add Tauri commands for stage/list/accept/reject/batch operations.
- [x] Add agent tools for proposing changes only.
- [x] Keep application mutations outside Rekordbox `master.db`; existing read-only DB tests still pass.

## Phase 6 — Inline Diff Review UI

- [x] Add diff review drawer/panel.
- [x] Show field, old value, new value, reason, confidence, status, and controls.
- [x] Group changes by track/playlist (`DiffReviewPanel.tsx` groups by `target_id` with collapsible per-target sections).
- [x] Add batch accept/reject where safe.
- [x] Add tests for proposed/accepted/rejected UI lifecycle basics.

## Phase 7 — XML Export

- [x] Build current-library XML export with accepted changes overlaid.
- [x] Add `export_accepted_changes` Tauri command plus frontend save-dialog wrapper.
- [x] Validate accepted changes before write.
- [x] Parse generated XML before marking exported.
- [x] Mark exported changes as exported after success.
- [x] Rust unit tests for playlist mutation export (`PlaylistRename`, `PlaylistCreate`, `PlaylistAddTrack`, `PlaylistRemoveTrack`, `PlaylistDelete`) in `apps/desktop/src-tauri/src/lib.rs` tests module.

## Phase 8 — One Complete MVP Workflow

- [x] Add “Audit library” workflow entry point.
- [x] Expose missing files, duplicate candidates, missing/weird metadata, and playlist issue tools to the agent.
- [x] Let the agent propose safe staged changes.
- [x] Guide user through review and XML export.
- [x] Add deterministic Playwright coverage with mocked Tauri/model-independent responses.

## Phase 9 — Playwright E2E

- [x] Add Playwright config and scripts.
- [x] Replace `scripts/seed-test-library.sh` with deterministic SQLCipher fixture generation; current E2E still uses mocked Tauri IPC fixtures for speed and model independence.
- [x] Cover first-run fixture load, track selection, playlist view, chat audit entry point, diff accept/reject, and XML export.
- [x] Keep E2E model-independent by mocking app-side data responses.

## Phase 10 — Local macOS Release Build

- [x] Run full automated suite before packaging.
- [x] Run `pnpm --filter desktop tauri build` on macOS.
- [ ] Verify packaged app with real/disposable library.
- [x] Document artifact path and signing/notarization limitations.
- [x] Create `docs/releases/v0.2.0.md`.

## Phase 11 — Full UI Audit + Redesign Suggestions

- [x] Complete `docs/UI_AUDIT.md` after MVP workflow exists.
- [x] Prioritize redesign tasks without blocking MVP release.

## Working Rules

- Keep Markdown current in the same commit as code.
- Work in small phases.
- Run relevant tests after each phase.
- Do not directly mutate Rekordbox `master.db`.
- Prefer coherent MVP flow over a wide set of half-finished features.
