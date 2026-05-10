# UI Specification

> Living document — update in the same commit as the code it describes.

## Layout

Three-pane default (all panes collapsible, layout persisted per workspace):

```
┌─────────────┬──────────────────────────────┬────────────────┐
│  Library    │  Focus (track detail / set   │  Agent chat    │
│  browser    │  timeline / diff view)        │  panel         │
│  (left)     │  (center)                     │  (right)       │
└─────────────┴──────────────────────────────┴────────────────┘
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause selected track |
| `J` | Scrub backward |
| `L` | Scrub forward |
| `K` | Stop / reset playhead |
| `Cmd+K` | Command palette |
| `Cmd+/` | Open / focus agent chat |
| `↑ / ↓` | Navigate track list |
| `Enter` | Open track in focus pane |

## Design rules

- **No emoji in UI chrome.** Tabler icons only.
- **Light + dark from day one.** Toggle via system preference or Settings.
- **Diffs everywhere.** Every agent-proposed change appears as old → new with accept/reject per row or in bulk.
- **Collapsible tool calls.** Most recent expanded; older collapsed by default.
- **Empty states designed.** Every empty list shows a useful next action.
- **Errors are friendly.** Message + action + "Copy details" button. No raw stack traces.
- **Latency budgets:** UI interactions < 100 ms, library queries < 250 ms, tool-call streaming indicator within 200 ms.

## Component conventions

- All colors via Tailwind design tokens; no hardcoded hex values in components.
- Radix UI primitives for accessible dialogs, dropdowns, tooltips, scroll areas.
- TanStack Table + TanStack Virtual for all large lists (virtualized).
- Zustand for global UI state (selected track, active pane, layout).
- TanStack Query for all async data fetching from Tauri IPC commands.
