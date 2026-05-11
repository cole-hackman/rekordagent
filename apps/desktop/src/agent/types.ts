import type {
  Track,
  Playlist,
  HotCue,
  PlaylistDetail,
  DuplicateGroup,
  BrokenMetadataReport,
} from "../types";

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

export interface TrackResult {
  tool: "library.get_track";
  track: Track | null;
  id: string;
}

export interface PlaylistsResult {
  tool: "library.list_playlists";
  playlists: Playlist[];
}

export interface PlaylistResult {
  tool: "library.get_playlist";
  detail: PlaylistDetail | null;
  id: string;
}

export interface CuesResult {
  tool: "library.list_cues";
  cues: HotCue[];
  track_id: string;
}

export interface OrphanResult {
  tool: "health.orphan_scan";
  orphans: Track[];
}

export interface DuplicateResult {
  tool: "health.duplicate_scan";
  groups: DuplicateGroup[];
}

export interface BrokenLinkResult {
  tool: "health.broken_link_scan";
  report: BrokenMetadataReport;
}

export type ToolPayload =
  | SearchResult
  | TrackResult
  | PlaylistsResult
  | PlaylistResult
  | CuesResult
  | OrphanResult
  | DuplicateResult
  | BrokenLinkResult;
