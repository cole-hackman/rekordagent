# decks

> Local-first AI DJ assistant for Rekordbox 7

**Status:** MVP implementation in progress. Core desktop workflows and local MCP tooling are implemented; real-library validation and release verification remain.

## What it does

`decks` is being built as a local-first AI DJ assistant for Rekordbox 7.

Implemented today:

- Read-only Rekordbox 7 SQLCipher library access.
- Library browser with virtualized, filterable, sortable track table; resizable columns and multi-select.
- Track detail panel with metadata and high-fidelity native Pioneer ANLZ color waveform (PWAV/PWV3/PWV4/PWV5).
- Native audio preview with play/pause, seek, and interactive waveform scrubbing.
- Settings for theme, library path, Claude model selection, and Anthropic API key in the OS keychain.
- In-app Claude chat panel with read-only tools, staged changes, inline diff review, and Rekordbox XML export.
- Conversation persistence in a local SQLite (WAL) cache.
- Safe staged-change lifecycle (`Proposed → Accepted/Rejected → Exported`); `master.db` is never mutated.
- One-click audit workflow plus dedicated Inbox view for tracks missing metadata, cues, or playlist membership.
- Bulk "Add intro cues" tool that reads the real ANLZ beat grid to stage perfect 1.1 downbeat memory cues + 4-bar loops.
- Smart broken-path Relocate workflow with fuzzy filename + size matching.
- Analytics dashboard (genre / key / BPM distributions, recharts).
- Audio-fingerprint duplicate detection (chromagram hash + Hamming grouping).
- Provider-neutral local MCP server via `decks mcp` (stdio) and `decks mcp-http` (local HTTP) for Claude Code, Gemini CLI, and OpenAI Responses API remote MCP.
- `decks tools call` diagnostic CLI for direct tool invocation.
- Rekordbox XML parse/emit crate with round-trip tests.
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
