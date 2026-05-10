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
