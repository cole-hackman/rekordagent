# decks

> Local-first AI DJ assistant for Rekordbox 7

**Status:** MVP implementation in progress. Core desktop workflows and local MCP tooling are implemented; real-library validation and release verification remain.

## What it does

`decks` is being built as a local-first AI DJ assistant for Rekordbox 7.

Implemented today:

**Library access & browsing**
- Rekordbox 7 SQLCipher library access — read by default, opt-in write via Sync.
- Library browser with virtualized, filterable, sortable track table; resizable columns, multi-select, and right-click context actions.
- Track detail panel with metadata and high-fidelity native Pioneer ANLZ color waveform (PWAV/PWV3/PWV4/PWV5).
- Native audio preview with play/pause, seek, and interactive waveform scrubbing.
- Analytics dashboard (genre / key / BPM distributions, recharts).

**Workflow views**
- **Inbox** — tracks missing metadata, cues, or playlist membership, with one-click audit.
- **Incoming** — ingest new files from the filesystem, fuzzy-match against the library, and stage adds.
- **Track Matcher** — manual review surface for ambiguous matches (powered by the `track-matcher` crate).
- **Smart Fixes** — title/artist normalization (case, encoded chars, garbage, URLs, promo tags, extracted remixer/artist) via the `smart-fixes` crate.
- **Cleanup** — broken-path Relocate workflow with fuzzy filename + size matching, plus audio-fingerprint duplicate detection (chromagram hash + Hamming grouping).
- **Custom Tags** — manage user tags with picker modal and bulk apply.
- **Archive** — review and restore previously archived tracks.
- **Sync** — apply staged changes back to `master.db` with WAL-lock detection (refuses to write while Rekordbox is running) and per-session backup before first write.

**Agent & change pipeline**
- In-app Claude chat panel with read-only tools, staged changes, inline diff review, and Rekordbox XML export.
- Conversation persistence in a local SQLite (WAL) cache.
- Staged-change lifecycle (`Proposed → Accepted/Rejected → Exported/Applied`) for metadata, cue, playlist, and track-delete operations.
- Bulk "Add intro cues" tool that reads the real ANLZ beat grid to stage perfect 1.1 downbeat memory cues + 4-bar loops.

**Tooling & integrations**
- Provider-neutral local MCP server via `decks mcp` (stdio) and `decks mcp-http` (local HTTP) for Claude Code, Gemini CLI, and OpenAI Responses API remote MCP.
- `decks tools call` diagnostic CLI for direct tool invocation.
- Rekordbox XML parse/emit crate with round-trip tests.
- Settings for theme, library path, Claude model selection, and Anthropic API key in the OS keychain.
- Playwright E2E coverage of the full audit → diff → export path.

MVP work still in progress:

- Real-library manual UI walkthrough and `v0.1.0` tag.
- Manual launch verification of the packaged macOS `.app` / DMG against a real/disposable library.

## Architecture

Tauri 2 desktop shell · Rust core · TypeScript/React frontend · local-first, privacy-first.

See [docs/architecture.md](docs/architecture.md) for details.
See [docs/MVP_PLAN.md](docs/MVP_PLAN.md) for the current MVP implementation plan.
See [docs/MCP.md](docs/MCP.md) for Claude Code, Gemini CLI, and OpenAI MCP runtime options.

## Development

```sh
# Prerequisites: Rust stable, Node 20+, pnpm 9+
./scripts/dev.sh
```

## Attribution

Core Rust logic vendored and adapted from [reklawdbox](https://github.com/ryan-voitiskis/reklawdbox) (MIT, Ryan Voitiskis). See [NOTICE](NOTICE).

## License

MIT — see [LICENSE](LICENSE).
