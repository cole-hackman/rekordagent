# Architecture

> Living document — update in the same commit as the code it describes.

## Overview

`decks` is a native desktop application with a three-layer architecture:

```
┌─────────────────────────────────────────────────────────┐
│  React / TypeScript frontend  (apps/desktop/src)        │
│  Vite · Tailwind · Radix UI · Zustand · TanStack Query  │
├─────────────────────────────────────────────────────────┤
│  Tauri IPC layer  (apps/desktop/src-tauri)              │
│  Typed commands + events bridging frontend ↔ Rust core  │
├─────────────────────────────────────────────────────────┤
│  Rust core  (crates/*)                                  │
│  rekordbox-db · rekordbox-xml · audio-analysis          │
│  audio-tags · enrichment · classify · scoring           │
│  changes · cache · embeddings · prodjlink               │
│  ranker · plugins · decks-core (facade)                 │
└─────────────────────────────────────────────────────────┘
```

## Key design principles

- **Local-first**: all data stays on the user's machine; enrichment API calls go through a local cache first.
- **Read-only DB**: `master.db` is opened with read-only flags everywhere except the Phase 6 opt-in live-patch mode.
- **Staged changes**: all proposed library mutations accumulate in the `changes` crate's `ChangeManager` and are only applied via XML export (or Phase 6 direct patch).
- **Privacy-first**: no telemetry, no analytics, no remote logging.

## Crate dependency graph

```
decks-core ──▶ rekordbox-db, rekordbox-xml, cache, changes, scoring, classify
apps/cli   ──▶ decks-core
src-tauri  ──▶ decks-core
```

Phase 4+ crates (`embeddings`, `prodjlink`, `ranker`, `plugins`) are pulled in by `decks-core` when their features are enabled.

## Data flow (Phase 1)

```
master.db (read-only)
    │  rekordbox-db
    ▼
Track / Playlist / Cue structs
    │  Tauri IPC
    ▼
TanStack Query cache (frontend)
    │  React components
    ▼
Library browser UI
```
