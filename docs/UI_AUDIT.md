# UI Audit and Redesign Notes

> Second pass completed after MVP review. This document serves as both a design specification and a redesign roadmap, not a release blocker.

---

## Design Direction

The app is a professional DJ library management tool. The aesthetic target is **precision instrument** — the look and feel of professional DJ hardware (Pioneer CDJ-3000, Rekordbox desktop, Serato DJ). This means:

- **Backgrounds**: Near-true-black (deeper than zinc-950's blue cast). `#0a0a0a` as the base shell, with zinc-900/800 for surfaces and elevated elements.
- **Accent color**: Swap indigo → amber/orange. Indigo reads as generic SaaS. Amber reads as hardware readout, edit/active state, record button. This is a deliberate brand choice.
- **Data density**: Every pixel of density is justified. This is a tool used by people with thousands of tracks who need to see as much as possible. Generous spacing is a bug here, not a feature.
- **The 8-color hot cue palette** (red, orange, yellow, green, cyan, blue, violet, pink) is already used throughout the app and is a strong design anchor. These same hues should be used for status badges, category indicators, and decorative accents — making them feel intentional rather than accidental.
- **Tone**: Precise, focused, slightly austere. Not playful. Not corporate. Like a well-designed piece of audio hardware.

---

## Typography System

**Current state**: Zero custom fonts. System UI stack everywhere. No typographic hierarchy beyond `font-bold` and size changes. BPM values, keys, and timestamps use the same font as labels and headings, making the UI feel undifferentiated.

**Target system**:

| Role | Font | Use |
|------|------|-----|
| UI / labels / headings | `Instrument Sans` | Panel headers, nav labels, button text, section headings |
| Data / numbers | `IBM Plex Mono` | BPM, key, duration, cue times, track IDs, file paths, counts |

**Rationale**: "Instrument" in the name is intentional for this tool. IBM Plex Mono has the precise, technical readout quality of Pioneer CDJ displays — tabular-nums, excellent at 10-12px, clearly machine-generated values. Together they create a strong visual split between "interface" and "data."

**Import**: Add to `index.html` via Google Fonts preconnect, both families with relevant weights (`400`, `500`, `600` for Instrument Sans; `400`, `500` for IBM Plex Mono).

**Apply**:
- `body { font-family: 'Instrument Sans', sans-serif; }`
- Apply `font-mono` Tailwind class (or `font-['IBM_Plex_Mono']`) to: BPM column, Key column, Duration, Cue times, file paths, track counts, any numeric readout.
- Tailwind config: extend `fontFamily` with both under `sans` and `mono` keys.

---

## Color Token System

**Current state**: All colors are Tailwind utility classes hardcoded inline across 8+ component files. `tailwind.config.ts` has `theme: { extend: {} }` — empty. There is no design system. A palette change requires touching every component.

**Target**: Define semantic CSS variables in `index.css`, mapped to Tailwind extended theme colors:

```css
:root {
  --bg-base:       #0a0a0a;
  --bg-surface:    #111111;
  --bg-elevated:   #1a1a1a;
  --border-subtle: #1f1f1f;
  --border-default:#2a2a2a;
  --border-strong: #3f3f3f;
  --text-primary:  #f0f0f0;
  --text-secondary:#a0a0a0;
  --text-muted:    #555555;
  --accent:        #f59e0b;   /* amber-400 */
  --accent-hover:  #fbbf24;   /* amber-300 */
  --accent-dim:    #78350f;   /* amber-900 for subtle highlight rows */
  --status-ok:     #4ade80;   /* green-400 */
  --status-warn:   #fb923c;   /* orange-400 */
  --status-error:  #f87171;   /* red-400 */
}
```

Light mode: override variables in `.light {}` or `html:not(.dark) {}` rather than using Tailwind's `dark:` variants everywhere. This is simpler for a primarily-dark app.

---

## Motion & Animation Patterns

**Current state**: Only `animate-spin` (loading spinners). Zero transitions on panels, row selection, or state changes. The app feels static and brittle.

**Target — minimal and purposeful**:

| Interaction | Pattern | Duration |
|-------------|---------|---------|
| Right panel open/close | `translate-x-full` → `translate-x-0`, ease-out | 150ms |
| Row selection highlight | `transition-colors` crossfade | 80ms |
| Diff status change (accept/reject) | opacity + border-color crossfade | 120ms |
| Toast notification | slide up from bottom-right + fade in | 200ms |
| Panel content replace (switching Library ↔ Playlists) | opacity fade | 100ms |
| All button/interactive hover | `transition-colors` | 150ms (already partially in use — make consistent) |

No page-load orchestration needed — this is a desktop app with instant local data, not a web app with loading waterfalls. Keep motion purposeful and fast.

---

## Navigation Problems

- The app currently relies on a top header plus optional panels. There is no durable left navigation for Library, Playlists, Changes, or Workflows.
- **Root cause of confusion**: `Playlists`, `Details`, `Changes`, and `Agent` buttons in the header all use identical `text-sm` styling with the same hover state. But Playlists is a primary view toggle (changes the workspace content) while Details/Changes/Agent are inspector panels (add a sidebar). These are fundamentally different interaction types with the same affordance.
- The `Details` button only renders when a track is selected (`selectedTrack && ...`). This is a hidden affordance — first-time users cannot discover that a track inspector exists.
- Chat, settings, and track detail compete for right-side space with no visual priority system.
- Playlist browsing exists but is a header toggle instead of a primary destination.
- Changes are accessed by a header toggle, making review/export feel secondary despite being central to the MVP workflow.

**Target IA**:
- Left sidebar (48px wide collapsed / 160px expanded): Library, Playlists, Changes, Audit, Settings as icon+label items. Active state uses amber accent. Settings moves here from its fixed overlay position.
- Header becomes: brand mark + search + status (track count, library name, background task state).
- Right inspector: track detail or agent chat, switchable, consistent width (320px).
- Bottom status bar: library path, audio playback state, export state, background agent progress.

---

## Visual Hierarchy Problems

- Primary user tasks are not visually separated: browse library, inspect track, ask agent, review changes all exist at the same visual weight.
- Tool call cards and result summaries are present but complex scan results need richer tables and drill-downs.
- Current styling is functional but generic. No custom fonts, no design tokens, no personality.
- The brand name "decks" appears as `text-sm font-bold` — 14px bold, indistinguishable from any other header label. The brand is invisible.

---

## Track Table Usability

- Virtualized table, filtering, sorting, and selection work well.
- **Inconsistent number formatting**: BPM and Key columns use `text-sm` (proportional font). Cue times in TrackDetailPanel use `font-mono tabular-nums` correctly. BPM/Key should match — without a monospace font, BPM columns shift width as values change on sort.
- Missing useful columns/toggles: playlist membership, path health, metadata completeness, staged workflow state.
- Empty/error states are minimal.
- No indication of which tracks have staged changes pending review.

---

## Playlist Browsing UX

- Basic playlist list/search/detail exists with a two-pane layout.
- The playlist view fills the main workspace rather than a fixed-height band (improvement from v1).
- Playlist issue indicators are missing.
- Playlist track rows should support inspect, find-in-library, and issue badges.
- Folder hierarchy is flattened; nested folders should be a real collapsible tree.

---

## Chat / Agent UX

- Chat streams text and shows tool call chips.
- Tool results are summarized but not inspectable enough for larger scans.
- Conversation history is persisted with a minimal selector.
- The audit workflow launcher exists but should be promoted into a workflow surface with progress, reviewed changes, and export status.

---

## Diff Review UX

- Diff review exists as a right-side panel with status counts, old/new values, reasons, confidence, accept/reject, safe batch accept, reject proposed, and XML export.
- It is still a flat list. Next pass should group by track/playlist and support filtering by status/kind.
- **Right panel width mismatch**: DiffReviewPanel is `w-[28rem]` (448px) while TrackDetailPanel and ChatPanel are `w-80` (320px). Switching between panels causes layout jank with no visual justification for the difference.
- Export success is shown inline; a toast/status system would make it easier to notice.

---

## Settings UX

- Theme, library path, Anthropic key, and Claude Code local status detection are present.
- **Settings as overlay vs. view**: SettingsPanel uses `fixed` positioning as a full-screen overlay with a semi-transparent backdrop. For a desktop app, a dedicated Settings view reachable from the left sidebar would feel more native and allow more space.
- The app distinguishes current API-key chat support from future Claude Code subscription-backed runtime support.
- Errors are not consistently recoverable — no copy-details affordance.
- API/model settings are minimal (no model selection, no temperature, no token limits).

---

## Empty, Loading, and Error States

- Loading spinners exist but are generic.
- Empty states are sparse and should become task-oriented (e.g., "No tracks — open a library" with a button, not just a blank table).
- Errors need action labels and copy-details affordance for technical errors (SQLite failures, path errors, API errors).
- No toast or notification system exists — important feedback (export complete, key saved, error) has no persistent notification surface.

---

## Waveform Placeholder

- TrackDetailPanel has a dedicated waveform section that currently renders the text `"waveform"` with a gray background. This is prominent real estate (the full panel width) showing nothing useful.
- Short-term: replace with a cue position visualization — a horizontal bar showing cue point positions as colored dots using the hot cue color palette. This uses existing data (cues are already fetched) and gives the waveform area meaning before waveform rendering is implemented.

---

## Tailwind Configuration Gap

- `tailwind.config.ts` has `theme: { extend: {} }` — completely empty. The design system lives in scattered inline class strings across every component.
- Extend the config with: custom `fontFamily.sans` and `fontFamily.mono`, a `colors.accent` key, and the CSS variable tokens as `var(--...)` references. This enables `text-accent`, `bg-surface`, etc. as Tailwind utilities.

---

## Accessibility Issues

- Basic aria labels exist on many icon buttons.
- Keyboard navigation beyond spacebar is incomplete.
- Focus management for panels/drawers needs review.
- Color contrast should be checked after final theme is applied — amber accent on near-black backgrounds needs verification.
- No keyboard shortcut system at all. A desktop app at this data density needs `j/k` for row navigation, `/` to focus search, `Escape` to close panels, and `Space` for play.

---

## Desktop App Polish

The app still feels like a web dashboard in a desktop shell. Root causes:

1. **No custom fonts** — system UI is the tell that something isn't a native app
2. **No window chrome customization** — Tauri allows a custom drag region and frameless window; the default title bar breaks the design
3. **Uniform border-radius** — everything is `rounded-md`. Native apps vary corner radii semantically.
4. **No drag region** — the header bar should be `data-tauri-drag-region` so the window is draggable
5. **No keyboard shortcuts** — the app has zero registered keyboard bindings

---

## Suggested Information Architecture

- **Left sidebar**: Library, Playlists, Changes, Audit, Settings — icon+label, 48px items, amber active state
- **Center workspace**: Track table, playlist detail, diff review, workflow progress — switches based on sidebar selection
- **Right inspector**: Track inspector or agent chat, consistent 320px width, collapsible
- **Bottom status bar**: Library name/path, track count, audio state, export state, background agent progress

---

## Suggested Component System

- **SidebarItem**: icon + label, active/inactive/hover states, amber accent
- **DataTable** row/cell primitives with mono number cells
- **TrackInspector**: full panel with metadata, cue visualization, playback
- **PlaylistTree**: collapsible folder hierarchy
- **AgentPanel**: chat + tool result cards
- **ToolResultCard**: expandable, filterable for large results
- **DiffGroup**: track-level grouping with accept-all, child DiffRow items
- **Toast**: bottom-right notification with auto-dismiss and action button
- **EmptyState**: icon + message + action button
- **ErrorPanel**: message + copy-details button + retry action
- **StatusBar**: bottom-edge app status surface

---

## Phased Implementation Plan

### Phase 1 — Design foundation
1. Add `Instrument Sans` + `IBM Plex Mono` to `index.html` via Google Fonts preconnect
2. Extend `tailwind.config.ts` with custom font families and token color references
3. Define CSS token variables in `index.css`
4. Swap accent color from indigo → amber throughout all components
5. Apply IBM Plex Mono to all numeric columns (BPM, Key, Duration, cue times, counts)

### Phase 2 — Navigation & IA
6. Add left sidebar component (Library, Playlists, Changes, Audit, Settings)
7. Remove Playlists/Details/Changes toggles from header; header → brand + search + status
8. Move Settings from fixed overlay to left-nav destination view
9. Add `data-tauri-drag-region` to header; configure frameless window if desired

### Phase 3 — Panel & data polish
10. Standardize right panel widths (all 320px); add `translate-x` slide-in transition
11. Replace waveform placeholder with cue position bar (colored dots from existing cue data)
12. Add bottom status bar (library, audio, export, agent states)
13. Improve TrackDetailPanel section headers and metadata layout

### Phase 4 — State & feedback
14. Implement Toast/notification system
15. Improve empty/error/loading states with task-oriented content and copy-details
16. Group DiffReviewPanel by track with per-group accept-all
17. Keyboard navigation: `j/k` row movement, `/` search focus, `Escape` panel close, `Space` play
