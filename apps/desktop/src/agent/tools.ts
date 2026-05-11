import type Anthropic from "@anthropic-ai/sdk";
import {
  librarySearch,
  listPlaylists,
  healthOrphanScan,
  getTrack,
  getPlaylist,
  getTrackCues,
  healthDuplicateScan,
  healthBrokenLinkScan,
} from "../ipc";
import type { ToolPayload } from "./types";

// Tool schemas passed to the Claude API
export const TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: "library__search",
    description:
      "Search tracks in the Rekordbox library by text query across title, artist, album, genre, and comment.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Text to search for" },
        limit: {
          type: "number",
          description: "Max results to return (default 50)",
        },
      },
      required: ["query"],
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
    name: "library__get_track",
    description: "Fetch one track by Rekordbox track ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Rekordbox track ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "library__get_playlist",
    description: "Fetch one playlist and its ordered tracks by playlist ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Rekordbox playlist ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "library__list_cues",
    description: "List memory cues and hot cues for a track.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "Rekordbox track ID" },
      },
      required: ["track_id"],
    },
  },
  {
    name: "health__orphan_scan",
    description:
      "Find tracks whose audio files are missing from disk (orphan tracks).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "health__duplicate_scan",
    description:
      "Find likely duplicate tracks by normalized title and artist.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "health__broken_link_scan",
    description:
      "Find tracks with missing or suspicious metadata such as missing artist, BPM, key, or genre.",
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
    case "library__list_playlists": {
      const playlists = await listPlaylists(libraryPath);
      return { tool: "library.list_playlists", playlists };
    }
    case "library__get_track": {
      const id = String(input.id ?? "");
      const track = await getTrack(libraryPath, id);
      return { tool: "library.get_track", track, id };
    }
    case "library__get_playlist": {
      const id = String(input.id ?? "");
      const detail = await getPlaylist(libraryPath, id);
      return { tool: "library.get_playlist", detail, id };
    }
    case "library__list_cues": {
      const trackId = String(input.track_id ?? "");
      const cues = await getTrackCues(libraryPath, trackId);
      return { tool: "library.list_cues", cues, track_id: trackId };
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
      const report = await healthBrokenLinkScan(libraryPath);
      return { tool: "health.broken_link_scan", report };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
