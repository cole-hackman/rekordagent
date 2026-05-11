# Architecture Decision Records

## ADR-0001 — Tauri v2 over Electron

**Date:** 2026-05-10
**Status:** Accepted

**Context:** We need a cross-platform desktop shell for a native-feeling app that bundles Rust backend code alongside a React/TypeScript frontend. The two main candidates are Electron (Chromium + Node.js, JS-only backend) and Tauri v2 (system WebView + Rust backend, with optional JS/TS sidecar processes).

**Decision:** Use Tauri v2.

**Reasons:**
1. Our core logic is Rust (SQLCipher access, audio analysis, beam-search sequencer, ONNX runtime). Tauri lets us call these crates directly as a Rust binary; Electron would force a FFI boundary or a subprocess for every native call.
2. Binary size: Tauri apps are ~5–10 MB vs. 80–150 MB for Electron because Tauri uses the OS WebView instead of bundling Chromium.
3. Memory footprint: a typical Tauri app uses 30–80 MB RSS vs. 200–400 MB for Electron, which matters when the user is also running Rekordbox and a DAW.
4. Security model: Tauri's allowlist + CSP surface area is smaller than Electron's Node.js integration.
5. Active maintenance: Tauri v2 is stable as of late 2024 with macOS, Windows, and Linux support.

**Trade-offs accepted:**
- System WebView differences (Safari on macOS, WebView2 on Windows, WebKitGTK on Linux) mean we must test on all three. Mitigation: CI matrix + explicit polyfills for any missing APIs.
- Tauri's plugin ecosystem is smaller than Electron's. Mitigation: most functionality we need is in Rust crates, not JS plugins.

## ADR-0002 — Keep MVP Agent Runtime on Anthropic API, Detect Claude Code Separately

**Date:** 2026-05-11
**Status:** Accepted

**Context:** The current chat implementation uses the Anthropic Messages API from the desktop frontend, authenticated by an Anthropic API key stored in the OS keychain. Users with Claude Pro/Max may also be signed in to Claude Code locally, but that subscription is not the same product surface as a generic third-party app API key. Claude Code can authenticate with a Claude.ai subscription for terminal-based Claude Code workflows.

**Decision:** For MVP, keep the in-app chat runtime on the existing Anthropic API-key path and add local Claude Code detection in Settings/error states. Do not claim Claude subscription support until a dedicated Claude Code runtime adapter is implemented and tested.

**Reasons:**
1. The current agent loop depends on Messages API tool calls and streaming behavior.
2. Claude Code subscription authentication is CLI-owned; treating it as a drop-in API key would be misleading and brittle.
3. Detecting Claude Code status gives users an accurate explanation without blocking current agent functionality.

**Follow-up:** Add a separate Claude Code runtime adapter if it can preserve tool execution, conversation persistence, and safe staged-change behavior without direct Rekordbox DB writes.
