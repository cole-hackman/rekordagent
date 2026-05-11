# decks

> Local-first AI DJ assistant for Rekordbox 7

**Status:** MVP implementation in progress. Foundation is mostly implemented; real-library validation, playlist UI, staged changes, XML export, E2E tests, and release verification remain.

## What it does

`decks` is being built as a local-first AI DJ assistant for Rekordbox 7.

Implemented today:

- Read-only Rekordbox 7 SQLCipher library access.
- Library browser with virtualized track table.
- Track detail panel with metadata and cue display.
- Native audio preview play/pause.
- Settings for theme, library path, and Anthropic API key in the OS keychain.
- Basic Claude chat panel with read-only tools for track search, playlist listing, and orphan scan.
- Rekordbox XML parse/emit crate.

MVP work still in progress:

- Real-library manual validation and `v0.1.0` tag.
- Dedicated playlist view and playlist-detail tooling.
- Expanded read-only agent tools.
- Conversation persistence.
- Safe staged changes, inline diff review, and Rekordbox XML export.
- One complete audit → review → export workflow.
- Playwright E2E tests, macOS packaged build verification, and UI audit.

## Architecture

Tauri 2 desktop shell · Rust core · TypeScript/React frontend · local-first, privacy-first.

See [docs/architecture.md](docs/architecture.md) for details.
See [docs/MVP_PLAN.md](docs/MVP_PLAN.md) for the current MVP implementation plan.

## Development

```sh
# Prerequisites: Rust stable, Node 20+, pnpm 9+
./scripts/dev.sh
```

## Attribution

Core Rust logic vendored and adapted from [reklawdbox](https://github.com/ryan-voitiskis/reklawdbox) (MIT, Ryan Voitiskis). See [NOTICE](NOTICE).

## License

MIT — see [LICENSE](LICENSE).
