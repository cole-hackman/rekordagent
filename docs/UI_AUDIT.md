# UI Audit and Redesign Notes

> This document starts as audit scaffolding and should be completed after the MVP workflow exists.

## Current Navigation Problems

- The app currently relies on a top header plus panels; there is no durable left navigation model for Library, Playlists, Changes, or Workflows.
- Chat, settings, and track detail compete for right-side space.
- Playlist browsing has no dedicated home yet.

## Visual Hierarchy Problems

- Primary user tasks are not visually separated: browse library, inspect track, ask agent, review changes.
- Tool call cards show that a tool ran but do not yet make results easy to scan.
- Current styling is functional but generic and lacks strong desktop-app hierarchy.

## Track Table Usability

- Virtualized table, filtering, sorting, and selection work.
- Missing useful columns/toggles for playlist context, path health, metadata completeness, and selected workflow state.
- Empty/error states are minimal.

## Playlist Browsing UX

- Dedicated playlist list/search/detail views are missing.
- Playlist issue indicators are missing.
- Agent playlist answers are limited by missing `get_playlist` tool.

## Chat / Agent UX

- Chat streams text and shows tool call chips.
- Tool results are currently hidden from the user instead of summarized.
- Conversation history is not persisted.
- No workflow launcher or clear “what changed” bridge into diff review yet.

## Diff Review UX

- Missing.
- MVP needs a dedicated review surface with status counts, grouping, old/new values, reasons, confidence, and accept/reject controls.

## Settings UX

- Theme, library path, and Anthropic key are present.
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

- The current app feels like a web dashboard in a shell.
- MVP redesign should move toward denser, native-feeling navigation, consistent panel sizing, and clearer command/status feedback.

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

1. Add left sidebar and dedicated Playlist view.
2. Render useful chat tool results.
3. Add diff review drawer/panel.
4. Add status/toast system.
5. Improve empty/error/loading states.
6. Tighten typography, spacing, and density.
7. Add keyboard navigation for track and playlist browsing.
8. Review accessibility and focus management.
