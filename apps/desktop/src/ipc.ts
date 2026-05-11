import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Track, HotCue, Playlist } from "./types";

export async function pickLibraryPath(): Promise<string | null> {
  const result = await open({
    title: "Locate master.db",
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    multiple: false,
    directory: false,
  });
  if (result === null || result === undefined) return null;
  return typeof result === "string" ? result : null;
}

export async function validateLibraryPath(path: string): Promise<number> {
  return invoke<number>("validate_library_path", { path });
}

export async function listTracks(path: string): Promise<Track[]> {
  return invoke<Track[]>("list_tracks", { path });
}

export async function getTrackCues(
  path: string,
  trackId: string,
): Promise<HotCue[]> {
  return invoke<HotCue[]>("get_track_cues", { path, trackId });
}

export async function getLibraryPath(): Promise<string | null> {
  return invoke<string | null>("get_library_path");
}

export async function setLibraryPath(path: string): Promise<void> {
  return invoke<void>("set_library_path", { path });
}

export async function playTrack(path: string): Promise<void> {
  return invoke<void>("play_track", { path });
}

export async function pauseAudio(): Promise<void> {
  return invoke<void>("pause_audio");
}

export async function resumeAudio(): Promise<void> {
  return invoke<void>("resume_audio");
}

export async function stopAudio(): Promise<void> {
  return invoke<void>("stop_audio");
}

export interface PlaybackState {
  is_playing: boolean;
  path: string | null;
}

export async function getPlaybackState(): Promise<PlaybackState> {
  return invoke<PlaybackState>("get_playback_state");
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getTheme(): Promise<string | null> {
  return invoke<string | null>("get_theme");
}

export async function setTheme(theme: string): Promise<void> {
  return invoke<void>("set_theme", { theme });
}

export async function getApiKey(service: string): Promise<string | null> {
  return invoke<string | null>("get_api_key", { service });
}

export async function setApiKey(service: string, key: string): Promise<void> {
  return invoke<void>("set_api_key", { service, key });
}

export async function deleteApiKey(service: string): Promise<void> {
  return invoke<void>("delete_api_key", { service });
}

// ── Claude CLI agent ─────────────────────────────────────────────────────────

export async function claudeAvailable(): Promise<boolean> {
  return invoke<boolean>("claude_available");
}

export async function chatWithClaude(
  message: string,
  sessionId: string | null,
  eventName: string,
): Promise<string> {
  return invoke<string>("chat_with_claude", { message, sessionId, eventName });
}

// ── Agent tools ───────────────────────────────────────────────────────────────

export async function librarySearch(
  path: string,
  query: string,
  limit?: number,
): Promise<Track[]> {
  return invoke<Track[]>("library_search", { path, query, limit });
}

export async function listPlaylists(path: string): Promise<Playlist[]> {
  return invoke<Playlist[]>("list_playlists", { path });
}

export async function healthOrphanScan(path: string): Promise<Track[]> {
  return invoke<Track[]>("health_orphan_scan", { path });
}

