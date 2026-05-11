# UI Audit and Redesign Notes

> Completed after the first MVP workflow was implemented. This is a redesign roadmap, not a release blocker.

## Current Navigation Problems

- The app currently relies on a top header plus optional panels; there is no durable left navigation model for Library, Playlists, Changes, or Workflows.
- Chat, settings, and track detail compete for right-side space.
- Playlist browsing exists, but it is a collapsible band above the table instead of a durable primary view.
- Changes are accessed by a header toggle, which makes review/export feel secondary even though it is central to MVP.

## Visual Hierarchy Problems

- Primary user tasks are not visually separated: browse library, inspect track, ask agent, review changes.
- Tool call cards and result summaries are present, but complex scan results need richer tables and drill-downs.
- Current styling is functional but generic and lacks strong desktop-app hierarchy.

## Track Table Usability

- Virtualized table, filtering, sorting, and selection work.
- Missing useful columns/toggles for playlist context, path health, metadata completeness, and staged workflow state.
- Empty/error states are minimal.

## Playlist Browsing UX

- Basic playlist list/search/detail exists.
- The playlist view now fills the main workspace rather than a fixed-height band.
- Playlist issue indicators are missing.
- Playlist track rows should support inspect, find in library, and issue badges.
- Folder hierarchy is flattened; nested folders should become a real tree.

## Chat / Agent UX

- Chat streams text and shows tool call chips.
- Tool results are summarized, but not inspectable enough for larger scans.
- Conversation history is persisted with a minimal selector.
- The audit workflow launcher exists, but should be promoted into a workflow surface with progress, reviewed changes, and export status.

## Diff Review UX

- Diff review exists as a right-side panel with status counts, old/new values, reasons, confidence, accept/reject, safe batch accept, reject proposed, and XML export.
- It is still a flat list. The next pass should group by track/playlist and support filtering by status/kind.
- Export success is shown inline; a toast/status system would make it easier to notice.

## Settings UX

- Theme, library path, Anthropic key, and Claude Code local status detection are present.
- The app now distinguishes current API-key chat support from future Claude Code subscription-backed runtime support.
- Errors are not yet consistently recoverable with copy details.
- API/model settings are minimal.

## Empty, Loading, and Error States

- Loading spinners exist.
- Empty states are sparse and should become task-oriented.
- Errors need action labels and copy details where relevant.

## Accessibility Issues

- Basic aria labels exist on many icon buttons.
- Keyboard navigation beyond spacebar is incomplete.
- Focus management for panels/drawers needs review.
- Color contrast should be checked after final UI state exists.

## Desktop App Polish

- The current app still feels like a web dashboard in a shell.
- MVP redesign should move toward denser native-feeling navigation, consistent panel sizing, clearer command/status feedback, and more predictable inspector behavior.

## Suggested Information Architecture

- Left sidebar: Library, Playlists, Changes, Workflows, Settings.
- Center workspace: table/detail, playlist detail, diff review, workflow progress.
- Right inspector: track inspector or agent, switchable and collapsible.
- Bottom/status area: current library, audio state, export state, background task state.

## Suggested Component System

- Navigation/sidebar item
- Data table row/cell primitives
- Track inspector
- Playlist browser/detail
- Tool result card
- Diff row and diff group
- Toast/status message
- Empty state
- Error panel with copy details

## Prioritized Redesign Tasks

1. Add left sidebar with Library, Playlists, Changes, Audit, and Settings destinations.
2. Promote Playlists to a dedicated view with folder tree, track table, and issue badges.
3. Redesign the change review panel around grouped diffs, filters, and export status.
4. Add a toast/status system for save, export, keychain, audio, and agent errors.
5. Improve empty/error/loading states with clear actions and copyable technical details.
6. Tighten typography, spacing, and density so table, inspector, chat, and review surfaces feel like one app.
7. Add keyboard navigation for track, playlist, chat, and diff review flows.
8. Review accessibility, focus management, and color contrast across all panels.
