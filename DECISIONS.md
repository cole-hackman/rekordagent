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

## ADR-0003 — MCP Server as the Subscription-Friendly Runtime Path

**Date:** 2026-05-11
**Status:** Accepted

**Context:** Claude Code can use a Claude subscription as the model host and call local tools through MCP. OpenAI and Gemini can also consume MCP through their supported host surfaces, though OpenAI API usage generally needs a reachable HTTP/remote MCP transport rather than local stdio.

**Decision:** Make Rekordagent's backend tools available through a provider-neutral MCP server. Keep the embedded Tauri chat on Anthropic API keys for now, while recommending Claude Code + `decks mcp` for subscription-backed Claude usage.

**Reasons:**
1. This matches the proven reklawdbox-style model: model host owns authentication/subscription, Rekordagent owns local tools.
2. It avoids pretending a Claude Pro subscription is an Anthropic API key.
3. A shared Rust tool service keeps MCP, CLI, and Tauri behavior aligned.
4. Stdio MCP is the fastest path for Claude Code and Gemini CLI; HTTP MCP can be added later for OpenAI remote MCP.

**Trade-offs accepted:**
- The in-app chat still needs an API key until it is replaced or backed by an external host workflow.
- MCP discovery uses host-safe underscore tool names while internal documentation may still mention dotted semantic names.
- XML export is not advertised over MCP until export logic moves into the shared tool service.

## ADR-0004 — Semantic CSS Token System Over Inline Tailwind Values

**Date:** 2026-05-11
**Status:** Accepted

**Context:** All colors in the initial codebase were hardcoded Tailwind utility classes spread across 8+ component files with an empty `tailwind.config.ts`. A palette or theme change required touching every component. The app needed a coherent design system that could be maintained without a global search-and-replace.

**Decision:** Define semantic CSS custom properties in `index.css` (e.g. `--bg-base`, `--text-ink`, `--accent`) using the space-separated RGB format (`R G B`) so Tailwind opacity modifiers work natively. Extend `tailwind.config.ts` with token names (`bg-base`, `text-ink`, `accent`, `edge`, etc.) that reference the CSS variables via `rgb(var(--name) / <alpha>)`.

**Reasons:**
1. A single `index.css` change swaps the entire app theme — no component churn.
2. Space-separated RGB format is required for Tailwind's `bg-X/50`-style opacity modifiers to work with custom properties.
3. Semantic names (`bg-elevated`, `text-ink-secondary`) communicate intent rather than raw color values, making per-component styling decisions easier to audit.

**Trade-offs accepted:**
- Component authors must use token names, not raw Tailwind colors, or the theme contract breaks. Enforced by convention, not tooling.
- shadcn drop-in components expect different token names (`bg-primary`, `text-foreground`, etc.). Resolved by adding a second alias layer in `tailwind.config.ts` and `index.css` mapping those names to our semantic tokens.

## ADR-0005 — "Precision Instrument" Design Aesthetic

**Date:** 2026-05-11
**Status:** Accepted

**Context:** The initial app used generic SaaS aesthetics: indigo accent, system UI font, generous padding. This reads as a web dashboard rather than a professional DJ tool. Users of this app are DJs who spend hours in Rekordbox, Serato, or on Pioneer CDJ hardware — they expect data density, not consumer-app comfort.

**Decision:** Commit to a "precision instrument" aesthetic modeled on Pioneer CDJ-3000 and Rekordbox desktop:
- **Background**: Near-true-black (`#0a0a0a`) base shell; `zinc-900`/`zinc-800` for surfaces.
- **Accent**: Amber/orange (`#f59e0b` family) instead of indigo. Indigo is generic SaaS; amber reads as hardware readout, edit/active state, record indicator.
- **Typography**: `Instrument Sans` for UI/labels; `IBM Plex Mono` for all data/numbers (BPM, key, duration, cue times, track IDs). IBM Plex Mono has the precise readout quality of CDJ displays at 10–12px.
- **Density**: 28px row heights in the track table; 10–12px data font. Generous spacing is a defect here, not a feature.
- **Hot-cue palette** (red/orange/yellow/green/cyan/blue/violet/pink) as a design anchor — the same hues reused for status badges and indicators to feel intentional.

**Trade-offs accepted:**
- Near-black backgrounds can feel harsh on low-brightness displays. Acceptable for a tool aimed at DJs in dark venues.
- Vendor-hosted Google Fonts add a network dependency. Mitigated with preconnect hints; no hard offline requirement exists.

## ADR-0006 — ElevenLabs UI Components via shadcn Registry Pattern

**Date:** 2026-05-11
**Status:** Accepted

**Context:** The initial chat UI was custom-built with basic divs and inconsistent styling. ElevenLabs open-sourced a set of React chat UI primitives (Message, Response, ShimmeringText, Conversation, Waveform) designed for AI voice/chat interfaces, distributed as a shadcn-style copy-paste registry rather than an npm package.

**Decision:** Copy ElevenLabs UI components directly into `src/components/ui/`, adapt import paths to our `@/*` alias, and integrate them into ChatPanel and TrackDetailPanel. Wire up the required infrastructure: `@/*` path alias in `tsconfig.json` + `vite.config.ts`, `src/lib/utils.ts` with `cn()`, shadcn color name aliases in `tailwind.config.ts` and `index.css`.

**Reasons:**
1. The components solve real UX problems (StickToBottom scroll, Streamdown markdown, ShimmeringText thinking state) without reinventing them.
2. Copy-paste ownership means we can modify or remove any component without a fork/patch cycle.
3. The shadcn alias layer is a one-time setup that also enables future shadcn/ui component drops without per-component token mapping.

**Trade-offs accepted:**
- Bundle jumped ~470 KB → ~1.1 MB (gzipped) due to Streamdown's bundled shiki syntax highlighter. Acceptable for MVP; can be code-split later.
- The ElevenLabs `AudioPlayer` component was deliberately skipped — our existing `useAudioPlayer` + rodio backend already works; adding a competing HTML5 audio path would create duplication.

## ADR-0007 — Playlist Duplicate Entries Surfaced, Not Removed

**Date:** 2026-05-11
**Status:** Accepted

**Context:** The playlist panel was showing duplicate track rows. This looked like a data-display bug, but investigation confirmed that `djmdSongPlaylist` stores one row per playlist entry without a unique constraint — Rekordbox legitimately allows the same track to appear multiple times in the same playlist.

**Decision:** Surface duplicates explicitly rather than deduplicating them. A `DUP` badge (amber-outlined mono pill) marks any row whose track ID has appeared earlier in the list. The playlist header shows the duplicate count when any exist.

**Reasons:**
1. The data is correct. Silently deduplicating would destroy user intent (e.g., a DJ set that intentionally revisits a track).
2. Making duplicates visible tells the user when their playlist has a repeat, which is often accidental and useful to know.
3. Deletion/deduplication is a write operation; all MVP changes route through the staged-change system, not the UI directly.

**Trade-offs accepted:**
- "DUP" labeling may confuse users who don't know Rekordbox allows this. Tooltip/help text can clarify; deferred.

## ADR-0008 — Synthetic Waveform as Honestly-Labeled Preview

**Date:** 2026-05-11
**Status:** Accepted

**Context:** The track inspector needed a waveform visualization. Real audio waveform rendering requires decoding audio frames from disk (via a Rust audio crate like `symphonia`), downsampling to peaks, and shipping the peak array over IPC to the renderer — significant engineering work not needed for MVP.

**Decision:** Render a decorative synthetic waveform using a seeded pseudorandom generator (seed = `track.id` hash) as a deterministic stand-in. Use the ElevenLabs `StaticWaveform` component. Label the time-range header "preview" to communicate that this is not a real audio analysis. Cue markers and region gradients are real data overlaid on the fake waveform.

**Reasons:**
1. The cue-position visualization is useful even without real audio shape; the waveform fills the space and gives context for relative positions.
2. Deterministic seeding means the waveform doesn't change between renders for the same track, which avoids jarring visual noise.
3. Honest labeling avoids misleading the user about analysis quality.

**Follow-up:** Replace with real peak data once `symphonia` decode → downsample → IPC path is implemented. The `<StaticWaveform data={peaks}>` prop interface already accepts real data.

## ADR-0009 — Treat Agent-Driven Sessions as Untrusted Until Verified

**Date:** 2026-05-15
**Status:** Accepted

**Context:** The Phase 16–22 work (Gemini CLI agent sessions over 2026-05-11 and 2026-05-12) shipped a large amount of feature code but left the workspace in a non-compiling state. JOURNAL.md and STATUS.md described the work as "complete" with `pnpm tsc --noEmit` and `cargo check` "verified clean" — claims that were not reproducible. Specific issues:

1. `apps/desktop/src-tauri/src/lib.rs` registered the `library_stage_intro_cues` Tauri command but never implemented the function body.
2. `crates/agent-tools/src/service.rs` was updated with handlers for `RelocateScan` / `RelocateApply` / `LibraryReadFileTags` / `LibraryAnalyzeTrack` / `LibraryScanAndProposeMissing` / `HealthFuzzyDuplicateScan`, but the corresponding `ToolRequest` enum variants were never added to `types.rs`.
3. An entire 399-line `SetBuilderView.tsx` Phase 3 prototype was committed but never imported and never typechecked.
4. A `health__audio_fingerprint_scan` switch arm + IPC wrapper called a Tauri command that was never registered — would crash the agent on invocation.
5. STATUS.md was simultaneously *too pessimistic* (claiming HTTP MCP transport and diff grouping needed work — both were already shipped) and *too optimistic* (claiming a green test baseline that did not exist).

**Decision:** Treat agent-shipped work as untrusted until independently verified. Going forward:

1. Before accepting any agent's claim that a feature is "shipped", run the full local verification suite — `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`. A JOURNAL claim of "verified clean" without these commands' output captured in the same commit should be regarded as unconfirmed.
2. Compile-time errors in `main` are a release blocker regardless of how recently work was merged. STATUS.md must reflect actual workspace state, not aspirational state.
3. Doc drift cuts both ways: features can be shipped without STATUS.md catching up, and STATUS.md can list features as missing when they exist. Resolve drift before planning new work.

**Reasons:**
1. The cost of a broken `main` propagates: every later session is built on a foundation that does not build, and bugs compound silently.
2. Doc drift creates plan distortions — work was scoped against an inaccurate picture of reality.
3. Agent sessions that mix research, plumbing, and feature shipping can leave partial wiring behind. Independent verification is the cheapest way to catch this.

**Trade-offs accepted:**
- This rule makes agent-led sessions feel slower because every "done" is gated on verification output, not on the agent's self-report.
- Some of the partial wiring left behind (e.g., SetBuilderView, audio-fingerprint scan) had legitimate aspirations; deleting them in this remediation pass forfeits that progress. The deleted code is in git history and can be revisited.
