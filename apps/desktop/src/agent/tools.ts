import type Anthropic from "@anthropic-ai/sdk";
import { librarySearch, listPlaylists, healthOrphanScan } from "../ipc";
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
    name: "health__orphan_scan",
    description:
      "Find tracks whose audio files are missing from disk (orphan tracks).",
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
    case "health__orphan_scan": {
      const orphans = await healthOrphanScan(libraryPath);
      return { tool: "health.orphan_scan", orphans };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
