# decks

> Local-first AI DJ assistant for Rekordbox 7

**Status:** Phase 1 — foundations (work in progress)

## What it does

`decks` gives a DJ a beautiful, fast, AI-assisted interface to their Rekordbox 7 library:

- Library browser with waveform preview and audio playback
- Agent chat that can audit your collection, fix metadata, build sets, and more
- Inline diff review — every proposed change is shown old → new, accept/reject per row
- Audio embedding similarity search ("find tracks that sound like this")
- Live deck integration via Pioneer PRO DJ LINK
- Export changes back to Rekordbox via XML import — your DB is never touched directly

## Architecture

Tauri 2 desktop shell · Rust core · TypeScript/React frontend · local-first, privacy-first.

See [docs/architecture.md](docs/architecture.md) for details.

## Development

```sh
# Prerequisites: Rust stable, Node 20+, pnpm 9+
./scripts/dev.sh
```

## Attribution

Core Rust logic vendored and adapted from [reklawdbox](https://github.com/ryan-voitiskis/reklawdbox) (MIT, Ryan Voitiskis). See [NOTICE](NOTICE).

## License

MIT — see [LICENSE](LICENSE).
