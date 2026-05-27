import type Anthropic from "@anthropic-ai/sdk";
import {
  librarySearch,
  libraryStageIntroCues,
  listPlaylists,
  healthOrphanScan,
  getTrack,
  getPlaylist,
  getTrackCues,
  healthDuplicateScan,
  healthFuzzyDuplicateScan,
  healthBrokenLinkScan,
  stageChange,
  listChanges,
  relocateScan,
} from "../ipc";
import type { ChangeKind, NewStagedChange, ToolPayload } from "./types";

const CHANGE_KINDS: ChangeKind[] = [
  "TrackMetadataEdit",
  "CueMetadataEdit",
  "PlaylistCreate",
  "PlaylistRename",
  "PlaylistDelete",
  "PlaylistAddTrack",
  "PlaylistRemoveTrack",
  "PlaylistReorderTrack",
];

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
    name: "health__fuzzy_duplicate_scan",
    description:
      "Find likely-duplicate candidates by collapsing remix/feature/parenthetical markers from title and artist. Treat results as candidates needing manual review.",
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
  {
    name: "staging__stage_change",
    description:
      "Propose a staged library change for user review. This does not write to the Rekordbox database and does not apply the change.",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          enum: CHANGE_KINDS,
          description: "Type of staged change to propose",
        },
        target_id: {
          type: "string",
          description: "Affected Rekordbox track, cue, or playlist ID",
        },
        field: {
          type: "string",
          description: "Changed metadata field, when applicable",
        },
        old_value: { description: "Current value, when known" },
        new_value: { description: "Proposed value" },
        reason: { type: "string", description: "Short user-facing reason" },
        confidence: {
          type: "number",
          description: "Confidence from 0 to 1, when available",
        },
      },
      required: ["kind"],
    },
  },
  {
    name: "staging__list_changes",
    description:
      "List staged changes and their review status for the active library.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "relocate__scan",
    description:
      "Find relocation candidates for broken/missing files by scanning root directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        search_roots: {
          type: "array",
          items: { type: "string" },
          description: "List of absolute directory paths to scan for missing music files.",
        },
      },
      required: ["search_roots"],
    },
  },
  {
    name: "relocate__apply",
    description:
      "Stage a folder_path update for a broken file.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "Rekordbox track ID" },
        new_path: { type: "string", description: "The new absolute path to the audio file." },
      },
      required: ["track_id", "new_path"],
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
      return { tool: "library.search", query, tracks };
    }
    case "library__bulk_add_intro_cues": {
      const trackIds = (input.track_ids as string[]) ?? [];
      const changes = await libraryStageIntroCues(libraryPath, trackIds);
      return { tool: "library.stage_intro_cues", changes };
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
    case "health__fuzzy_duplicate_scan": {
      const groups = await healthFuzzyDuplicateScan(libraryPath);
      return { tool: "health.fuzzy_duplicate_scan", groups };
    }
    case "health__broken_link_scan": {
      const report = await healthBrokenLinkScan(libraryPath);
      return { tool: "health.broken_link_scan", report };
    }
    case "staging__stage_change": {
      const kind = String(input.kind ?? "");
      if (!CHANGE_KINDS.includes(kind as ChangeKind)) {
        throw new Error(`Unknown change kind: ${kind}`);
      }
      const changeInput: NewStagedChange = {
        library_path: libraryPath,
        kind: kind as ChangeKind,
        target_id: optionalString(input.target_id),
        field: optionalString(input.field),
        old_value: input.old_value ?? null,
        new_value: input.new_value ?? null,
        reason: optionalString(input.reason),
        confidence:
          typeof input.confidence === "number" ? input.confidence : null,
      };
      const change = await stageChange(changeInput);
      return { tool: "staging.stage_change", change };
    }
    case "staging__list_changes": {
      const changes = await listChanges(libraryPath);
      return { tool: "staging.list_changes", changes };
    }
    case "relocate__scan": {
      const searchRoots = (input.search_roots as string[]) ?? [];
      const candidates = await relocateScan(libraryPath, searchRoots);
      return { tool: "relocate.scan", candidates };
    }
    case "relocate__apply": {
      const trackId = String(input.track_id ?? "");
      const newPath = String(input.new_path ?? "");
      const change = await stageChange({
        library_path: libraryPath,
        kind: "TrackMetadataEdit",
        target_id: trackId,
        field: "folder_path",
        old_value: null,
        new_value: newPath,
        reason: "Relocated missing file via agent",
        confidence: 1.0,
      });
      return { tool: "relocate.apply", change };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
