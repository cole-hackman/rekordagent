# Rekordagent Full Working MVP Implementation Plan

> Source-of-truth checklist for getting `decks` from the current working foundation to a coherent MVP.

## MVP Definition

A user can install/open the macOS app, connect a Rekordbox 7 library read-only, browse tracks and playlists, ask the agent read-only questions, run one audit workflow, review proposed safe changes as diffs, accept/reject changes, and export accepted changes as Rekordbox XML. `master.db` is never directly mutated.

## Phase Checklist

- [x] Phase 0 — Repo familiarization and status reconciliation.
- [ ] Phase 1 — Stabilize current foundation and tag `v0.1.0`.
- [x] Phase 2 — Define MVP agent and playlist scope.
- [x] Phase 3 — Implement missing read-only agent tools and playlist view.
- [~] Phase 4 — Conversation persistence.
- [ ] Phase 5 — Safe staged changes system.
- [ ] Phase 6 — Inline diff review UI.
- [ ] Phase 7 — XML export.
- [ ] Phase 8 — One complete MVP workflow.
- [ ] Phase 9 — Playwright E2E.
- [ ] Phase 10 — Local macOS release build.
- [ ] Phase 11 — Full UI audit and redesign suggestions.

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

- [ ] Add cache migrations for conversations, messages, and tool calls/results.
- [ ] Add Tauri conversation CRUD commands.
- [ ] Add frontend active conversation state and minimal selector UI.
- [ ] Persist library association, timestamps, roles, content blocks, tool inputs, and results.
- [ ] Add cache and frontend tests.

## Phase 5 — Safe Staged Changes System

- [ ] Implement `crates/changes` lifecycle and types.
- [ ] Persist staged changes in cache DB.
- [ ] Add Tauri commands for stage/list/accept/reject/batch operations.
- [ ] Add agent tools for proposing changes only.
- [ ] Add safety tests proving no `master.db` writes.

## Phase 6 — Inline Diff Review UI

- [ ] Add diff review drawer/panel.
- [ ] Show field, old value, new value, reason, confidence, status, and controls.
- [ ] Group changes by track/playlist.
- [ ] Add batch accept/reject where safe.
- [ ] Add tests for each change kind and lifecycle state.

## Phase 7 — XML Export

- [ ] Build current-library XML export with accepted changes overlaid.
- [ ] Add `export_accepted_changes(output_path?)` Tauri command.
- [ ] Validate accepted changes before write.
- [ ] Parse generated XML after write.
- [ ] Mark exported changes as exported after success.
- [ ] Add tests for metadata and playlist export.

## Phase 8 — One Complete MVP Workflow

- [ ] Add “Audit library and playlists” workflow entry point.
- [ ] Detect missing files, duplicate candidates, missing/weird metadata, and playlist issues.
- [ ] Let the agent propose safe staged changes.
- [ ] Guide user through review and XML export.
- [ ] Add deterministic tests using mocked model/tool responses.

## Phase 9 — Playwright E2E

- [ ] Add Playwright config and scripts.
- [ ] Replace `scripts/seed-test-library.sh` with deterministic fixture generation.
- [ ] Cover first-run fixture load, track selection, playlist view, chat tool execution, playlist question, diff accept/reject, and XML export.
- [ ] Keep E2E model-independent by mocking agent responses.

## Phase 10 — Local macOS Release Build

- [ ] Run full automated suite before packaging.
- [ ] Run `pnpm --filter desktop tauri build` on macOS.
- [ ] Verify packaged app with real/disposable library.
- [ ] Document artifact path and signing/notarization limitations.
- [ ] Create `docs/releases/v0.2.0.md`.

## Phase 11 — Full UI Audit + Redesign Suggestions

- [ ] Complete `docs/UI_AUDIT.md` after MVP workflow exists.
- [ ] Prioritize redesign tasks without blocking MVP release.

## Working Rules

- Keep Markdown current in the same commit as code.
- Work in small phases.
- Run relevant tests after each phase.
- Do not directly mutate Rekordbox `master.db`.
- Prefer coherent MVP flow over a wide set of half-finished features.
