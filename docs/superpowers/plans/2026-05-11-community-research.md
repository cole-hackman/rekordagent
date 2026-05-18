# Community Repository Research

**Date**: 2026-05-11
**Conducted by**: Gemini AI Agent

This document summarizes research into several community-driven Rekordbox tools and libraries to identify features, algorithms, and code concepts that could be ported to our Rust/Tauri desktop application (`decks`).

## Repositories Analyzed

### 1. [reklawdbox](https://github.com/ryan-voitiskis/reklawdbox)
*   **Overview:** An AI-agent-powered library manager that uses the Model Context Protocol (MCP). It provides read-only access to the Rekordbox database, stages changes in memory, and exports them via XML for safe re-import.
*   **Technologies:** Rust (core), TypeScript (docs), Cloudflare Workers (API broker), SQLCipher, Essentia (audio analysis).
*   **Portability to `decks`:**
    *   *We have already adopted the Staged Mutation Pattern from this repo, allowing safe XML exports instead of direct DB writes.*
    *   *We have vendored their `stratum-dsp` crate for native Rust audio analysis.*
    *   **Future:** The Broker-Mediated Enrichment pattern using Cloudflare Workers to proxy Discogs/Beatport API calls could be useful for handling OAuth without exposing client secrets.

### 2. [rekordbox-mcp](https://github.com/davehenke/rekordbox-mcp)
*   **Overview:** A comprehensive MCP server providing 31+ tools for searching, analytics, playlist management, and track importing.
*   **Technologies:** Python, FastMCP, pyrekordbox, Pydantic.
*   **Portability to `decks`:**
    *   **Advanced Search Logic:** Implements multi-field filtering (Key, BPM range, Rating, Play Count) that could inspire more complex SQL queries in our Rust backend.
    *   **Library Analytics:** Logic for calculating genre distribution, average BPM, and "most played" insights could be added to our frontend dashboards.

### 3. [pyrekordbox](https://github.com/dylanljones/pyrekordbox)
*   **Overview:** The "gold standard" unofficial library for interacting with Rekordbox files, including the database, XML, ANLZ (analysis), and MySettings.
*   **Technologies:** Python, SQLCipher, Kaitai Struct.
*   **Portability to `decks`:**
    *   **Binary File Parsing (ANLZ):** Contains the logic for parsing `.DAT`, `.EXT`, and `.2EX` analysis files (waveforms, beatgrids, cues). Porting this to Rust would allow our Tauri app to render high-fidelity Pioneer waveforms natively.
    *   **Device Library Plus:** Support for the newer export format used by OPUS-QUAD and XDJ-AZ.
    *   **SQLCipher Configuration:** Detailed knowledge of unlocking `master.db` across different Rekordbox versions.

### 4. [Rekordbox Export Analysis (Deep Symmetry)](https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/exports.html)
*   **Overview:** Exhaustive technical documentation of the `export.pdb` (DeviceSQL) format used on USB/SD exports.
*   **Technologies:** Documentation, Kaitai Struct.
*   **Portability to `decks`:**
    *   **Native PDB Parser:** Provides the blueprint for writing a Rust parser to read DJ-ready USB sticks directly, covering page headers, row offsets, and Pioneer's string encoding.
    *   **Relational Mapping:** Explains how Tracks, Artists, and Playlists are linked in the binary format (which differs from SQLite `master.db`).

### 5. [rekordbox-library-fixer](https://github.com/koraysels/rekordbox-library-fixer)
*   **Overview:** A GUI tool for detecting duplicates and relocating missing ("!") tracks.
*   **Technologies:** React, TypeScript, Electron, Dexie.js (IndexedDB).
*   **Portability to `decks`:**
    *   **Audio Fingerprinting:** Logic for finding identical tracks even with different filenames/metadata.
    *   **Relocation Algorithms:** Smart search patterns to find moved music folders by matching file size and partial metadata. This could vastly improve our `orphan_scan` tool.
    *   **UI/UX for Resolution:** A proven interface for "Quality-Based" vs "Date-Based" duplicate resolution.

## Strategic Takeaways for Next Features

1. **Waveform Rendering:** Port the `pyrekordbox` ANLZ parsing logic to Rust to feed real waveform data into our UI.
2. **Advanced Broken-Link Recovery:** Port the smart relocation algorithms from `rekordbox-library-fixer` to help users fix broken paths automatically.
3. **USB Export Parsing:** Use the Deep Symmetry PDB documentation to eventually allow `decks` to read from and write to USB drives natively.
4. **Rich Analytics:** Implement library statistics tools inspired by `rekordbox-mcp`.