import type { Track, Playlist } from "../types";

// ── Conversation message types ────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolCallBlock {
  type: "tool_call";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export type ContentBlock = TextBlock | ToolCallBlock | ToolResultBlock;

export interface UserMessage {
  role: "user";
  text: string;
}

export interface AssistantMessage {
  role: "assistant";
  /** Blocks in order of arrival: text and tool-call blocks. */
  blocks: ContentBlock[];
}

export interface ToolResultMessage {
  role: "tool_results";
  results: ToolResultBlock[];
}

export type ChatMessage = UserMessage | AssistantMessage | ToolResultMessage;

// ── Tool result payload types ─────────────────────────────────────────────────

export interface SearchResult {
  tool: "library.search";
  tracks: Track[];
  query: string;
}

export interface PlaylistsResult {
  tool: "library.list_playlists";
  playlists: Playlist[];
}

export interface OrphanResult {
  tool: "health.orphan_scan";
  orphans: Track[];
}

export type ToolPayload = SearchResult | PlaylistsResult | OrphanResult;
