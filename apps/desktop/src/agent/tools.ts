import type Anthropic from "@anthropic-ai/sdk";
import {
  librarySearch,
  listPlaylists,
  listPlaylistEntries,
  getTrackById,
  getTrackCues,
  healthOrphanScan,
  healthDuplicateScan,
  healthBrokenLinkScan,
} from "../ipc";
import type { ToolPayload } from "./types";

// Tool schemas passed to the Claude API
export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  // ── Library ────────────────────────────────────────────────────────────────
  {
    name: "library__search",
    description:
      "Search tracks in the Rekordbox library by text query across title, artist, album, genre, and comment.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Text to search for" },
        limit: { type: "number", description: "Max results to return (default 50)" },
      },
      required: ["query"],
    },
  },
  {
    name: "library__get_track",
    description: "Fetch full details for a single track by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "Rekordbox track ID" },
      },
      required: ["track_id"],
    },
  },
  {
    name: "library__list_playlists",
    description: "List all playlists and folders in the Rekordbox library.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "library__list_playlist_entries",
    description: "List the tracks in a specific playlist by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        playlist_id: { type: "string", description: "Rekordbox playlist ID" },
      },
      required: ["playlist_id"],
    },
  },
  {
    name: "library__list_cues",
    description: "List all hot cues for a track.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "Rekordbox track ID" },
      },
      required: ["track_id"],
    },
  },
  // ── Health ─────────────────────────────────────────────────────────────────
  {
    name: "health__orphan_scan",
    description: "Find tracks whose audio files are missing from disk.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "health__duplicate_scan",
    description:
      "Find groups of tracks that are likely duplicates (same title + artist).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "health__broken_link_scan",
    description:
      "Find tracks with missing or suspicious metadata (no BPM, no key, no artist, BPM out of range).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  libraryPath: string,
): Promise<ToolPayload> {
  switch (name) {
    case "library__search": {
      const query = String(input.query ?? "");
      const limit = typeof input.limit === "number" ? input.limit : 50;
      const tracks = await librarySearch(libraryPath, query, limit);
      return { tool: "library.search", tracks, query };
    }

    case "library__get_track": {
      const track_id = String(input.track_id ?? "");
      const track = await getTrackById(libraryPath, track_id);
      return { tool: "library.get_track", track };
    }

    case "library__list_playlists": {
      const playlists = await listPlaylists(libraryPath);
      return { tool: "library.list_playlists", playlists };
    }

    case "library__list_playlist_entries": {
      const playlist_id = String(input.playlist_id ?? "");
      const entries = await listPlaylistEntries(libraryPath, playlist_id);
      return { tool: "library.list_playlist_entries", playlist_id, entries };
    }

    case "library__list_cues": {
      const track_id = String(input.track_id ?? "");
      const cues = await getTrackCues(libraryPath, track_id);
      return { tool: "library.list_cues", track_id, cues };
    }

    case "health__orphan_scan": {
      const orphans = await healthOrphanScan(libraryPath);
      return { tool: "health.orphan_scan", orphans };
    }

    case "health__duplicate_scan": {
      const groups = await healthDuplicateScan(libraryPath);
      return { tool: "health.duplicate_scan", groups };
    }

    case "health__broken_link_scan": {
      const issues = await healthBrokenLinkScan(libraryPath);
      return { tool: "health.broken_link_scan", issues };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
