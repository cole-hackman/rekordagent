import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  Track,
  HotCue,
  Playlist,
  PlaylistDetail,
  DuplicateGroup,
  BrokenMetadataReport,
  LibraryAnalytics,
  TrackTags,
  TagWriteFields,
  AnalysisResult,
  AnlzWaveform,
  RelocateCandidate,
} from "./types";
import type {
  ChatMessage,
  ConversationSummary,
  NewStagedChange,
  PersistedConversation,
  PersistedConversationMessage,
  StagedChange,
} from "./agent/types";

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

export async function getTrack(
  path: string,
  trackId: string,
): Promise<Track | null> {
  return invoke<Track | null>("get_track", { path, trackId });
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

export interface PlaybackStatus {
  is_playing: boolean;
  path: string | null;
  /** Seconds since playback started, 0 if no track loaded. */
  time: number;
  /** Total track duration in seconds, 0 if unknown. */
  duration: number;
}

export async function getPlaybackState(): Promise<PlaybackState> {
  return invoke<PlaybackState>("get_playback_state");
}

export async function getPlaybackStatus(): Promise<PlaybackStatus> {
  return invoke<PlaybackStatus>("get_playback_status");
}

export async function seekAudio(timeSecs: number): Promise<void> {
  return invoke<void>("seek_audio", { timeSecs });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getTheme(): Promise<string | null> {
  return invoke<string | null>("get_theme");
}

export async function setTheme(theme: string): Promise<void> {
  return invoke<void>("set_theme", { theme });
}

export type AgentModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

export async function getAgentModel(): Promise<AgentModel> {
  return invoke<AgentModel>("get_agent_model");
}

export async function setAgentModel(model: AgentModel): Promise<void> {
  return invoke<void>("set_agent_model", { model });
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

export interface ClaudeCodeStatus {
  installed: boolean;
  version: string | null;
  logged_in: boolean | null;
  auth_method: string | null;
  subscription_type: string | null;
  email: string | null;
  error: string | null;
}

export async function getClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
  return invoke<ClaudeCodeStatus>("get_claude_code_status");
}

// ── Conversations ────────────────────────────────────────────────────────────

export async function listConversations(
  libraryPath?: string | null,
): Promise<ConversationSummary[]> {
  return invoke<ConversationSummary[]>("list_conversations", {
    libraryPath: libraryPath ?? null,
  });
}

export async function createConversation(
  libraryPath: string | null,
  title: string,
): Promise<ConversationSummary> {
  return invoke<ConversationSummary>("create_conversation", {
    libraryPath,
    title,
  });
}

export async function loadConversation(
  id: string,
): Promise<PersistedConversation | null> {
  return invoke<PersistedConversation | null>("load_conversation", { id });
}

export async function appendConversationMessage(
  conversationId: string,
  role: string,
  content: ChatMessage,
): Promise<PersistedConversationMessage> {
  return invoke<PersistedConversationMessage>("append_conversation_message", {
    conversationId,
    role,
    content,
  });
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  return invoke<void>("rename_conversation", { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke<void>("delete_conversation", { id });
}

// ── Staged changes ───────────────────────────────────────────────────────────

export async function stageChange(
  change: NewStagedChange,
): Promise<StagedChange> {
  return invoke<StagedChange>("stage_change", { change });
}

export async function listChanges(
  libraryPath?: string | null,
): Promise<StagedChange[]> {
  return invoke<StagedChange[]>("list_changes", {
    libraryPath: libraryPath ?? null,
  });
}

export async function acceptChange(id: string): Promise<StagedChange> {
  return invoke<StagedChange>("accept_change", { id });
}

export async function rejectChange(id: string): Promise<StagedChange> {
  return invoke<StagedChange>("reject_change", { id });
}

export async function acceptAllSafe(
  libraryPath?: string | null,
): Promise<StagedChange[]> {
  return invoke<StagedChange[]>("accept_all_safe", {
    libraryPath: libraryPath ?? null,
  });
}

export async function rejectAll(
  libraryPath?: string | null,
): Promise<StagedChange[]> {
  return invoke<StagedChange[]>("reject_all", {
    libraryPath: libraryPath ?? null,
  });
}

export interface ExportResult {
  output_path: string;
  exported_count: number;
}

export async function exportAcceptedChanges(
  libraryPath: string,
  outputPath?: string | null,
): Promise<ExportResult | null> {
  const resolvedPath =
    outputPath ??
    (await save({
      title: "Export Rekordbox XML",
      defaultPath: "rekordagent-export.xml",
      filters: [{ name: "Rekordbox XML", extensions: ["xml"] }],
    }));
  if (!resolvedPath) return null;
  return invoke<ExportResult>("export_accepted_changes", {
    libraryPath,
    outputPath: resolvedPath,
  });
}

// ── Agent tools ───────────────────────────────────────────────────────────────

export async function librarySearch(
  path: string,
  query: string,
  limit?: number,
): Promise<Track[]> {
  return invoke<Track[]>("library_search", { path, query, limit });
}

export async function suggestNextTracks(
  path: string,
  trackId: string,
  limit?: number,
): Promise<[Track, import("./types").TransitionScore][]> {
  return invoke<[Track, import("./types").TransitionScore][]>("suggest_next_tracks", { path, trackId, limit });
}

export async function libraryStageIntroCues(
  libraryPath: string,
  trackIds: string[],
): Promise<StagedChange[]> {
  return invoke<StagedChange[]>("library_stage_intro_cues", {
    libraryPath,
    trackIds,
  });
}

export async function listPlaylists(path: string): Promise<Playlist[]> {
  return invoke<Playlist[]>("list_playlists", { path });
}

export async function getPlaylist(
  path: string,
  playlistId: string,
): Promise<PlaylistDetail | null> {
  return invoke<PlaylistDetail | null>("get_playlist", { path, playlistId });
}

export async function listTracksWithCues(path: string): Promise<string[]> {
  return invoke<string[]>("list_tracks_with_cues", { path });
}

export async function listTracksInAnyPlaylist(path: string): Promise<string[]> {
  return invoke<string[]>("list_tracks_in_any_playlist", { path });
}

export async function listTracksWithMissingFiles(
  path: string,
): Promise<string[]> {
  return invoke<string[]>("list_tracks_with_missing_files", { path });
}

export async function healthOrphanScan(path: string): Promise<Track[]> {
  return invoke<Track[]>("health_orphan_scan", { path });
}

export async function healthDuplicateScan(path: string): Promise<DuplicateGroup[]> {
  return invoke<DuplicateGroup[]>("health_duplicate_scan", { path });
}

export async function healthFuzzyDuplicateScan(path: string): Promise<DuplicateGroup[]> {
  return invoke<DuplicateGroup[]>("health_fuzzy_duplicate_scan", { path });
}

export async function healthBrokenLinkScan(
  path: string,
): Promise<BrokenMetadataReport> {
  return invoke<BrokenMetadataReport>("health_broken_link_scan", { path });
}

export async function getLibraryAnalytics(
  path: string,
): Promise<LibraryAnalytics> {
  return invoke<LibraryAnalytics>("library_analytics", { path });
}

export async function readAudioTags(filePath: string): Promise<TrackTags> {
  return invoke<TrackTags>("read_audio_tags", { filePath });
}

export async function analyzeTrack(
  libraryPath: string,
  trackId: string,
): Promise<AnalysisResult> {
  return invoke<AnalysisResult>("analyze_track", {
    libraryPath,
    trackId,
  });
}

export async function getAnlzWaveform(
  libraryPath: string,
  trackId: string,
): Promise<AnlzWaveform> {
  return invoke<AnlzWaveform>("get_anlz_waveform", { libraryPath, trackId });
}

export async function getAudioWaveform(
  filePath: string,
  bars?: number,
): Promise<number[]> {
  return invoke<number[]>("get_audio_waveform", { filePath, bars: bars ?? null });
}

export async function writeAudioTags(
  filePath: string,
  fields: TagWriteFields,
): Promise<void> {
  return invoke<void>("write_audio_tags", { filePath, fields });
}

export async function relocateScan(
  libraryPath: string,
  searchRoots: string[],
): Promise<RelocateCandidate[]> {
  return invoke<RelocateCandidate[]>("relocate_scan", {
    libraryPath,
    searchRoots,
  });
}
