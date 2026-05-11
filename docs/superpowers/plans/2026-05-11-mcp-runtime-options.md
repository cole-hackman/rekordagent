# MCP Runtime Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Rekordagent's existing read-only, staged-change, and XML-export backend as a provider-neutral MCP server, while keeping the Tauri app and enabling Claude Code, OpenAI, and Gemini host options.

**Architecture:** Move shared tool execution out of the React/Anthropic-only layer into a Rust tool service that can be called by Tauri IPC, CLI, and MCP. Implement `decks mcp` as a local stdio MCP server first, then add host-specific setup docs for Claude Code and Gemini CLI, and an optional HTTP MCP transport for OpenAI Responses API.

**Tech Stack:** Rust workspace, `decks-core`, `rekordbox-db`, `cache`, `changes`, `rekordbox-xml`, Tauri 2, React/TypeScript, MCP JSON-RPC over stdio, optional Streamable HTTP/SSE later.

---

## File Structure

- Create `crates/agent-tools/`: shared Rust tool contracts and execution service.
- Create `crates/agent-tools/src/lib.rs`: public exports for tool schemas and dispatcher.
- Create `crates/agent-tools/src/types.rs`: serializable request/response types for each tool.
- Create `crates/agent-tools/src/service.rs`: pure Rust implementation of each tool using existing crates.
- Create `crates/agent-tools/src/mcp.rs`: MCP protocol adapter for stdio.
- Modify `Cargo.toml`: add `crates/agent-tools` to workspace.
- Modify `apps/cli/Cargo.toml`: add `agent-tools`, `serde`, `serde_json`, and `clap`.
- Modify `apps/cli/src/main.rs`: add `decks mcp` and diagnostic commands.
- Modify `apps/desktop/src-tauri/src/lib.rs`: delegate duplicate Tauri command logic to `agent-tools` where practical.
- Modify `apps/desktop/src/agent/tools.ts`: keep browser-side Anthropic tool schemas for now, but align tool names and payloads with Rust contracts.
- Create `docs/MCP.md`: setup for Claude Code, Gemini CLI, and OpenAI HTTP MCP.
- Modify `README.md`, `STATUS.md`, `JOURNAL.md`, `DECISIONS.md`: document runtime split and progress.

## Phase 1: Shared Rust Tool Service

### Task 1: Add `agent-tools` crate

**Files:**
- Modify: `Cargo.toml`
- Create: `crates/agent-tools/Cargo.toml`
- Create: `crates/agent-tools/src/lib.rs`
- Create: `crates/agent-tools/src/types.rs`
- Create: `crates/agent-tools/src/service.rs`
- Test: `crates/agent-tools/src/service.rs`

- [ ] **Step 1: Add workspace member**

Add `"crates/agent-tools"` to the root `Cargo.toml` workspace members.

- [ ] **Step 2: Create crate manifest**

```toml
[package]
name = "agent-tools"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
anyhow = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
decks-core = { path = "../decks-core" }
cache = { path = "../cache" }
changes = { path = "../changes" }
```

- [ ] **Step 3: Define tool request enum**

In `crates/agent-tools/src/types.rs`, define stable tool names matching existing app semantics:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum ToolRequest {
    LibrarySearch { library_path: String, query: String, limit: Option<usize> },
    LibraryGetTrack { library_path: String, id: String },
    LibraryListPlaylists { library_path: String },
    LibraryGetPlaylist { library_path: String, id: String },
    LibraryListCues { library_path: String, track_id: String },
    HealthOrphanScan { library_path: String },
    HealthDuplicateScan { library_path: String },
    HealthBrokenLinkScan { library_path: String },
    StagingListChanges { library_path: Option<String> },
    ExportAcceptedChanges { library_path: String, output_path: String },
}
```

- [ ] **Step 4: Implement `AgentToolService`**

In `service.rs`, create `AgentToolService { cache_path: Option<PathBuf> }` with `execute(request: ToolRequest) -> anyhow::Result<serde_json::Value>`. Reuse existing `RekordboxDb` methods, `CacheDb`, and `generate_export_xml`-equivalent logic.

- [ ] **Step 5: Write failing tests**

Add tests for:
- `LibrarySearch` returns seeded tracks.
- `LibraryGetPlaylist` returns playlist plus ordered tracks.
- `LibraryListCues` returns cue rows.
- `HealthDuplicateScan` returns seeded duplicate groups.

Run:

```bash
cargo test -p agent-tools
```

Expected before implementation: failures for missing service behavior.

- [ ] **Step 6: Make tests pass**

Implement only the behavior needed for the above tests, using fixture helpers from `rekordbox-db` where possible.

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml crates/agent-tools
git commit -m "feat: add shared agent tool service"
```

## Phase 2: Local Stdio MCP Server

### Task 2: Add MCP stdio adapter

**Files:**
- Create/modify: `crates/agent-tools/src/mcp.rs`
- Modify: `crates/agent-tools/src/lib.rs`
- Modify: `apps/cli/Cargo.toml`
- Modify: `apps/cli/src/main.rs`
- Test: `crates/agent-tools/src/mcp.rs`

- [ ] **Step 1: Define MCP tool names**

Expose these MCP names:

```text
library.search
library.get_track
library.list_playlists
library.get_playlist
library.list_cues
health.orphan_scan
health.duplicate_scan
health.broken_link_scan
staging.list_changes
export.accepted_changes
```

- [ ] **Step 2: Implement JSON-RPC handlers**

Support:
- `initialize`
- `tools/list`
- `tools/call`
- `resources/list` initially returning an empty list
- `prompts/list` initially returning an empty list

Each `tools/call` validates required arguments and maps to `ToolRequest`.

- [ ] **Step 3: Add CLI subcommand**

Add `clap` to `apps/cli/Cargo.toml` and implement:

```bash
decks mcp
decks mcp --cache /path/to/cache.sqlite3
decks tools call library.search --library /path/to/master.db --json '{"query":"house","limit":5}'
```

The first command runs stdio forever. The second diagnostic command helps test without an MCP host.

- [ ] **Step 4: Add protocol tests**

Feed JSON-RPC requests into the MCP handler and assert:
- `tools/list` includes `library.search`.
- `tools/call` for `library.search` returns JSON content.
- unknown tools return a JSON-RPC error.

Run:

```bash
cargo test -p agent-tools mcp
cargo test -p decks-cli
```

- [ ] **Step 5: Commit**

```bash
git add crates/agent-tools apps/cli
git commit -m "feat: expose tools over mcp stdio"
```

## Phase 3: Claude Code Host Support

### Task 3: Add Claude Code setup and smoke test

**Files:**
- Create: `docs/MCP.md`
- Modify: `README.md`
- Modify: `STATUS.md`
- Test manually with installed `claude`

- [ ] **Step 1: Document install command**

Add:

```bash
cargo build -p decks-cli
claude mcp add -s user rekordagent -- /Users/coleh/rekordagent/target/debug/decks mcp
claude mcp list
```

- [ ] **Step 2: Document expected Claude prompt**

```text
Using the rekordagent MCP server, search my Rekordbox library at /path/to/master.db for tracks matching "UKG", then inspect the first playlist.
```

- [ ] **Step 3: Add safety section**

State clearly:
- MCP tools never write to `master.db`.
- Mutations must be staged.
- Exports write XML only.

- [ ] **Step 4: Smoke test locally**

Run:

```bash
claude mcp list
```

Expected: `rekordagent` appears connected.

- [ ] **Step 5: Commit**

```bash
git add docs/MCP.md README.md STATUS.md
git commit -m "docs: add claude code mcp setup"
```

## Phase 4: Gemini CLI Host Support

### Task 4: Add Gemini CLI setup docs

**Files:**
- Modify: `docs/MCP.md`
- Modify: `README.md`

- [ ] **Step 1: Document Gemini command**

Add:

```bash
gemini mcp add rekordagent /Users/coleh/rekordagent/target/debug/decks mcp
gemini mcp list
```

- [ ] **Step 2: Document `settings.json` fallback**

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

- [ ] **Step 3: Commit**

```bash
git add docs/MCP.md README.md
git commit -m "docs: add gemini cli mcp setup"
```

## Phase 5: Optional OpenAI HTTP MCP Transport

### Task 5: Add HTTP MCP transport behind a separate command

**Files:**
- Modify: `crates/agent-tools/Cargo.toml`
- Create: `crates/agent-tools/src/http.rs`
- Modify: `crates/agent-tools/src/lib.rs`
- Modify: `apps/cli/src/main.rs`
- Modify: `docs/MCP.md`
- Test: `crates/agent-tools/src/http.rs`

- [ ] **Step 1: Add HTTP server deps**

Use existing workspace `tokio`; add a minimal HTTP framework such as `axum` only if needed.

- [ ] **Step 2: Add command**

```bash
decks mcp-http --bind 127.0.0.1:8787
```

- [ ] **Step 3: Implement endpoints**

Support a Streamable HTTP MCP endpoint at:

```text
POST /mcp
```

Keep it local by default. Do not expose on `0.0.0.0` unless the user explicitly opts in.

- [ ] **Step 4: Add OpenAI docs**

Document that OpenAI Responses API can use remote MCP servers, but local stdio is not enough for the hosted OpenAI API path. For local development, users need a reachable HTTP MCP endpoint or a bridge.

- [ ] **Step 5: Commit**

```bash
git add crates/agent-tools apps/cli docs/MCP.md
git commit -m "feat: add optional http mcp transport"
```

## Phase 6: Tauri App Integration

### Task 6: Keep desktop UI, but route tool execution through shared service

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/components/SettingsPanel.tsx`
- Modify: `apps/desktop/src/agent/useAgent.ts`

- [ ] **Step 1: Add `agent-tools` to desktop backend**

```toml
agent-tools = { path = "../../../crates/agent-tools" }
```

- [ ] **Step 2: Replace duplicated backend logic gradually**

Move backend command bodies for `library_search`, `get_playlist`, health scans, and export through `AgentToolService`.

- [ ] **Step 3: Update Settings runtime copy**

Settings should show three runtime options:
- Anthropic API key: in-app chat, implemented.
- Claude Code MCP: external host, implemented after Phase 3.
- Gemini CLI MCP / OpenAI HTTP MCP: documented or implemented based on phase status.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri apps/desktop/src
git commit -m "refactor: share agent tool execution with desktop"
```

## Phase 7: Verification and Release Gate

### Task 7: Run full validation

**Files:**
- Modify: `STATUS.md`
- Modify: `JOURNAL.md`
- Modify: `docs/MANUAL_TEST_PLAN.md`

- [ ] **Step 1: Run automated suite**

```bash
cargo fmt --all -- --check
cargo test --workspace
pnpm test
pnpm typecheck
pnpm lint
pnpm e2e
```

- [ ] **Step 2: Run MCP smoke tests**

```bash
cargo run -p decks-cli -- tools call library.search --library fixtures/tiny-library/master.db --json '{"query":"Dark","limit":5}'
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | cargo run -p decks-cli -- mcp
```

- [ ] **Step 3: Manual host tests**

Confirm:
- Claude Code can list and call Rekordagent MCP tools.
- Gemini CLI can list and call Rekordagent MCP tools.
- OpenAI path is documented unless HTTP MCP is implemented.

- [ ] **Step 4: Update status docs**

Record exactly which hosts are implemented and tested.

- [ ] **Step 5: Commit**

```bash
git add STATUS.md JOURNAL.md docs/MANUAL_TEST_PLAN.md
git commit -m "docs: record mcp runtime verification"
```

## Explicit Non-Goals

- Do not let any MCP tool write directly to Rekordbox `master.db`.
- Do not remove Anthropic API-key chat until MCP-host workflows are proven.
- Do not build a custom OAuth/subscription bridge for Claude Pro.
- Do not expose HTTP MCP publicly by default.

## Self-Review

- Spec coverage: The plan covers all three desired runtime options: Claude Code via stdio MCP, OpenAI via optional HTTP MCP, and Gemini CLI via stdio MCP.
- Placeholder scan: No `TBD` or undefined future-only tasks are used; optional OpenAI HTTP is explicitly scoped.
- Type consistency: Tool names and request fields map directly to existing app tools and Rekordbox string IDs.
