import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeTool, TOOL_SCHEMAS } from "./tools";
import {
  getTrack,
  getPlaylist,
  getTrackCues,
  healthDuplicateScan,
  healthBrokenLinkScan,
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
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent tools", () => {
  it("declares the full MVP read-only tool surface", () => {
    expect(TOOL_SCHEMAS.map((tool) => tool.name).sort()).toEqual([
      "health__broken_link_scan",
      "health__duplicate_scan",
      "health__orphan_scan",
      "library__get_playlist",
      "library__get_track",
      "library__list_cues",
      "library__list_playlists",
      "library__search",
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
});
