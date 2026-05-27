import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeTool, TOOL_SCHEMAS } from "./tools";
import {
  getTrack,
  getPlaylist,
  getTrackCues,
  healthDuplicateScan,
  healthBrokenLinkScan,
  stageChange,
  listChanges,
} from "../ipc";

vi.mock("../ipc", () => ({
  librarySearch: vi.fn(),
  listPlaylists: vi.fn(),
  healthOrphanScan: vi.fn(),
  getTrack: vi.fn(),
  getPlaylist: vi.fn(),
  getTrackCues: vi.fn(),
  healthDuplicateScan: vi.fn(),
  healthBrokenLinkScan: vi.fn(),
  stageChange: vi.fn(),
  listChanges: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent tools", () => {
  it("declares the full MVP read-only tool surface", () => {
    expect(TOOL_SCHEMAS.map((tool) => tool.name).sort()).toEqual([
      "health__broken_link_scan",
      "health__duplicate_scan",
      "health__fuzzy_duplicate_scan",
      "health__orphan_scan",
      "library__get_playlist",
      "library__get_track",
      "library__list_cues",
      "library__list_playlists",
      "library__search",
      "relocate__apply",
      "relocate__scan",
      "staging__list_changes",
      "staging__stage_change",
    ]);
  });

  it("dispatches library__get_track", async () => {
    vi.mocked(getTrack).mockResolvedValue({ id: "1", title: "Track" } as never);
    const result = await executeTool("library__get_track", { id: "1" }, "/db");
    expect(getTrack).toHaveBeenCalledWith("/db", "1");
    expect(result.tool).toBe("library.get_track");
  });

  it("dispatches library__get_playlist", async () => {
    vi.mocked(getPlaylist).mockResolvedValue({ playlist: { id: "2" }, tracks: [] } as never);
    const result = await executeTool("library__get_playlist", { id: "2" }, "/db");
    expect(getPlaylist).toHaveBeenCalledWith("/db", "2");
    expect(result.tool).toBe("library.get_playlist");
  });

  it("dispatches library__list_cues", async () => {
    vi.mocked(getTrackCues).mockResolvedValue([]);
    const result = await executeTool("library__list_cues", { track_id: "1" }, "/db");
    expect(getTrackCues).toHaveBeenCalledWith("/db", "1");
    expect(result.tool).toBe("library.list_cues");
  });

  it("dispatches health scans", async () => {
    vi.mocked(healthDuplicateScan).mockResolvedValue([]);
    vi.mocked(healthBrokenLinkScan).mockResolvedValue({
      missing_artist: [],
      missing_bpm: [],
      missing_key: [],
      missing_genre: [],
      suspicious: [],
    });

    expect((await executeTool("health__duplicate_scan", {}, "/db")).tool).toBe(
      "health.duplicate_scan",
    );
    expect((await executeTool("health__broken_link_scan", {}, "/db")).tool).toBe(
      "health.broken_link_scan",
    );
  });

  it("dispatches staged change proposals without applying them", async () => {
    vi.mocked(stageChange).mockResolvedValue({
      id: "change-1",
      library_path: "/db",
      kind: "TrackMetadataEdit",
      target_id: "1",
      field: "genre",
      old_value: "House",
      new_value: "Deep House",
      reason: "Normalize genre",
      confidence: 0.9,
      status: "Proposed",
      created_at: 1,
      updated_at: 1,
    });

    const result = await executeTool(
      "staging__stage_change",
      {
        kind: "TrackMetadataEdit",
        target_id: "1",
        field: "genre",
        old_value: "House",
        new_value: "Deep House",
        reason: "Normalize genre",
        confidence: 0.9,
      },
      "/db",
    );

    expect(stageChange).toHaveBeenCalledWith({
      library_path: "/db",
      kind: "TrackMetadataEdit",
      target_id: "1",
      field: "genre",
      old_value: "House",
      new_value: "Deep House",
      reason: "Normalize genre",
      confidence: 0.9,
    });
    expect(result.tool).toBe("staging.stage_change");
  });

  it("lists staged changes for the active library", async () => {
    vi.mocked(listChanges).mockResolvedValue([]);
    const result = await executeTool("staging__list_changes", {}, "/db");
    expect(listChanges).toHaveBeenCalledWith("/db");
    expect(result.tool).toBe("staging.list_changes");
  });
});
