# Rekordagent MCP

Rekordagent now exposes its library tools as a local MCP server through the CLI:

```sh
cargo build -p decks-cli
./target/debug/decks mcp
```

The MCP server is provider-neutral. Claude Code, Gemini CLI, Cursor, and other MCP hosts can call the same tools without the Tauri chat panel making direct model API calls.

## Safety Model

- Rekordbox `master.db` is opened read-only.
- MCP tools do not write directly to `master.db`.
- Mutation workflows must use staged changes.
- XML export writes a separate Rekordbox XML file; it does not mutate the live database.
- The current MCP discovery surface intentionally omits XML export until the shared tool service owns the export path.

## Available MCP Tools

MCP advertises host-safe underscore tool names:

- `library_search`
- `library_get_track`
- `library_list_playlists`
- `library_get_playlist`
- `library_list_cues`
- `health_orphan_scan`
- `health_duplicate_scan`
- `health_fuzzy_duplicate_scan`
- `health_broken_link_scan`
- `staging_list_changes`

For compatibility with existing internal docs, the CLI/parser also accepts dotted aliases such as `library.search` for implemented tools.

Every library tool expects a `library_path` argument pointing at a Rekordbox 7 `master.db`.

## Claude Code

Claude Code can use this MCP server with your Claude subscription because Claude Code is the model host and Rekordagent is only the local tool server.

```sh
cargo build -p decks-cli
claude mcp add -s user rekordagent -- /Users/coleh/rekordagent/target/debug/decks mcp
claude mcp list
```

Example prompt:

```text
Using the rekordagent MCP server, search my Rekordbox library at /path/to/master.db for tracks matching "UKG", then inspect the first playlist.
```

## Gemini CLI

Gemini CLI can use the same stdio MCP server.

```sh
cargo build -p decks-cli
gemini mcp add rekordagent /Users/coleh/rekordagent/target/debug/decks mcp
gemini mcp list
```

If the CLI uses a settings file instead of `gemini mcp add`, configure:

```json
{
  "mcpServers": {
    "rekordagent": {
      "command": "/Users/coleh/rekordagent/target/debug/decks",
      "args": ["mcp"],
      "trust": false
    }
  }
}
```

## OpenAI

The OpenAI Responses API can use MCP tools when the MCP server is reachable through an HTTP/remote transport. Rekordagent includes a local-only HTTP MCP development transport:

```sh
cargo build -p decks-cli
/Users/coleh/rekordagent/target/debug/decks mcp-http --bind 127.0.0.1:8787
```

The HTTP transport currently supports one JSON-RPC request per `POST /mcp` request. It does not implement streaming or SSE. JSON-RPC notifications return HTTP `202 Accepted` with an empty body because notifications do not produce JSON-RPC responses.

Example request:

```sh
curl -sS http://127.0.0.1:8787/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Keep HTTP MCP local by default. The CLI default bind address is `127.0.0.1:8787`, and this development transport is not authenticated. Hosted OpenAI API calls cannot reach this loopback endpoint directly; use an authenticated HTTPS tunnel, proxy, or bridge if you deliberately expose it for remote MCP development. Do not bind to `0.0.0.0` unless there is a deliberate authentication and network exposure plan.

## Diagnostic CLI

You can call tools without an MCP host:

```sh
cargo run -p decks-cli -- tools call library_search \
  --library /path/to/master.db \
  --json '{"query":"UKG","limit":5}'
```

Dotted aliases also work:

```sh
cargo run -p decks-cli -- tools call library.search \
  --library /path/to/master.db \
  --json '{"query":"UKG","limit":5}'
```

For staged-change tools, pass the cache database path:

```sh
cargo run -p decks-cli -- tools call staging_list_changes \
  --library /path/to/master.db \
  --cache /path/to/cache.sqlite3 \
  --json '{}'
```

## Smoke Tests

List tools through raw JSON-RPC:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | cargo run -q -p decks-cli -- mcp
```

Call a search tool through raw JSON-RPC:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"library_search","arguments":{"library_path":"fixtures/tiny-library/master.db","query":"Dark","limit":5}}}' \
  | cargo run -q -p decks-cli -- mcp
```
