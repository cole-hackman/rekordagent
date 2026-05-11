# decks

> Local-first AI DJ assistant for Rekordbox 7

**Status:** MVP implementation in progress. Core desktop workflows and local MCP tooling are implemented; real-library validation and release verification remain.

## What it does

`decks` is being built as a local-first AI DJ assistant for Rekordbox 7.

Implemented today:

- Read-only Rekordbox 7 SQLCipher library access.
- Library browser with virtualized track table.
- Track detail panel with metadata and cue display.
- Native audio preview play/pause.
- Settings for theme, library path, and Anthropic API key in the OS keychain.
- In-app Claude chat panel with read-only tools, staged changes, and XML export through an Anthropic API key.
- Provider-neutral local MCP server via `decks mcp` for Claude Code, Gemini CLI, and other MCP hosts.
- Rekordbox XML parse/emit crate.

MVP work still in progress:

- Real-library manual validation and `v0.1.0` tag.
- MCP HTTP transport for OpenAI Responses API remote MCP usage.
- macOS packaged build verification against a real/disposable library.

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
