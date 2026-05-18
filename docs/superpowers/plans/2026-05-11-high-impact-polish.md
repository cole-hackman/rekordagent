# Plan: High-Impact Polish and Missing Links

This plan outlines the next set of priority tasks required to complete the core MVP feature set and improve existing functionalities.

## Goals
1. **Real Waveform Rendering:** Replace the synthetic waveform placeholder in the track inspector with real, decoded audio data.
2. **Audio Playback Upgrades:** Enhance the audio player to support scrubbing by exposing track duration and current time via IPC.
3. **Advanced Health Scans:** Implement new health checks such as a broken-file-path filter or an advanced duplicate-candidate detector.
4. **HTTP MCP Transport:** Expose agent tools over HTTP to allow remote agents (like OpenAI's API) to interact with the local Rekordbox library.

## Step-by-Step Implementation

### Phase 1: Real Waveform Rendering
*   **Rust Backend:**
    *   Integrate `symphonia` for audio decoding (already used in `crates/audio-analysis`).
    *   Create a fast downsampling pipeline to extract peak data (e.g., min/max pairs per visual pixel) from the decoded audio frames.
    *   Expose a new Tauri IPC command: `get_audio_waveform(track_path: &str) -> Vec<f32>`.
*   **Frontend UI:**
    *   Update `TrackDetailPanel.tsx` to call `get_audio_waveform` when a track is selected.
    *   Pass the resulting peak data array into the ElevenLabs `<StaticWaveform data={peaks}>` component.
    *   Remove the "preview" label once real data is flowing.

### Phase 2: Audio Playback Scrubbing
*   **Rust Backend (`rodio` integration):**
    *   Update the audio playback service to track the `current_time` and total `duration` of the active sink.
    *   Expose Tauri commands: `get_playback_status() -> { time, duration }` and `seek_audio(target_secs: f32)`.
*   **Frontend UI:**
    *   Enhance `useAudioPlayer.ts` to poll or subscribe to playback status updates.
    *   Update the `TrackDetailPanel` (or migrate to ElevenLabs `AudioPlayer`) to allow users to click the waveform and trigger `seek_audio`.

### Phase 3: Advanced Health Scans
*   **Broken-File-Path Filter:**
    *   Implement a fast file-system existence check in Rust: `check_file_exists(path)`.
    *   Add a toggle in `FilterDrawer.tsx` for "Missing Files".
    *   Filter out tracks whose `folder_path` points to a non-existent file on disk.
*   **Duplicate Candidates:**
    *   Expand `crates/health/` with a heuristic-based duplicate scanner (e.g., matching normalized Title + Artist, but ignoring minor typos).
    *   Surface these "likely duplicates" via an agent tool.

### Phase 4: HTTP MCP Transport
*   **Rust Backend (`decks-mcp` or `agent-tools`):**
    *   Implement a lightweight HTTP server (e.g., using `axum` or `hyper`).
    *   Map incoming HTTP JSON-RPC requests to the existing `ToolService` dispatch system.
    *   Provide endpoints for `GET /tools` and `POST /tools/call`.
*   **Integration:**
    *   Document the HTTP interface port/protocol so remote OpenAI models can be configured to point to `localhost:PORT/tools`.