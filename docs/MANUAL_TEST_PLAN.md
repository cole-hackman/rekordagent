# Manual Test Plan

> Run this checklist before release tags and after major workflow changes.

## Test Data

- Real Rekordbox 7 `master.db` for local validation.
- Disposable Rekordbox library for XML import validation.
- Synthetic fixture library generated with `./scripts/seed-test-library.sh`.

## v0.1.0 Foundation Checklist

- [ ] Launch app in dev mode with `./scripts/dev.sh`.
- [ ] If no library is configured, first-run wizard appears.
- [ ] Select a real Rekordbox 7 `master.db`.
- [ ] App validates DB and shows a nonzero track count.
- [ ] Track table loads and scrolls smoothly.
- [ ] Filter input matches title, artist, album, and genre.
- [ ] Column sorting works.
- [ ] Selecting a track opens the detail panel.
- [ ] Detail panel shows metadata and cues when present.
- [ ] Play button starts audio for tracks with a valid `folder_path`.
- [ ] Spacebar toggles play/pause when focus is not in an input.
- [ ] Theme changes persist after restart.
- [ ] Library path change validates and persists.
- [ ] Anthropic key save/remove works through OS keychain.
- [ ] Chat panel opens and closes.
- [ ] Current chat tools work: search, list playlists, orphan scan.
- [ ] No code path writes directly to `master.db`.

Known `v0.1.0` limitations:

- Waveform rendering is a placeholder.
- Scrub controls are deferred.
- Playlist view is not yet dedicated UI.
- Chat history is not persisted.
- Agent cannot stage/export changes yet.

## MVP / v0.2.0 Checklist

- [ ] App opens packaged macOS build, not only dev mode.
- [ ] Real library opens and displays tracks/playlists.
- [ ] Playlist list and selected playlist track view work.
- [ ] Agent answers read-only track and playlist questions.
- [ ] Conversation history survives restart.
- [ ] Audit workflow finds missing files, duplicates, missing/weird metadata, and playlist issues.
- [ ] Agent proposals appear as staged diffs.
- [ ] User can accept/reject individual changes.
- [ ] User can batch accept/reject safe groups.
- [ ] Export writes Rekordbox-importable XML.
- [ ] Generated XML parses with `rekordbox-xml`.
- [ ] Disposable Rekordbox library can import the generated XML.
- [ ] Exported changes are marked exported.
- [ ] Rejected changes are not exported.
- [ ] `master.db` remains unmodified.

## MCP Host Checklist

- [ ] Build CLI with `cargo build -p decks-cli`.
- [ ] `cargo run -p decks-cli -- tools call library_search --library fixtures/tiny-library/master.db --json '{"query":"Dark","limit":5}'` returns JSON.
- [ ] Raw `tools/list` smoke test returns `library_search`.
- [ ] Claude Code registers the server with `claude mcp add -s user rekordagent -- /Users/coleh/rekordagent/target/debug/decks mcp`.
- [ ] `claude mcp list` shows `rekordagent`.
- [ ] Claude Code can call `library_search` against a real Rekordbox `master.db`.
- [ ] Gemini CLI registers and lists the same MCP server.
- [ ] MCP tools do not write directly to `master.db`.
- [ ] OpenAI path is treated as pending until HTTP MCP transport exists.

## macOS Build Artifacts

Latest local build completed on 2026-05-11:

- App bundle: `target/release/bundle/macos/decks.app`
- DMG: `target/release/bundle/dmg/decks_0.1.0_aarch64.dmg`

Signing/notarization has not been configured. Treat the DMG as a local unsigned test artifact until release signing is added.

## Verification Commands

```sh
cargo test --workspace
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e
pnpm --filter desktop tauri build
```
