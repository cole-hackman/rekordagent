import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveView } from "./ArchiveView";
import {
  listArchivedTracks,
  stageTrackDelete,
  unarchiveTracks,
} from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", () => ({
  listArchivedTracks: vi.fn(),
  stageTrackDelete: vi.fn(),
  unarchiveTracks: vi.fn(),
  listTracksWithCues: vi.fn().mockResolvedValue([]),
  listTracksInAnyPlaylist: vi.fn().mockResolvedValue([]),
  listTracksWithMissingFiles: vi.fn().mockResolvedValue([]),
  listTracks: vi.fn().mockResolvedValue([]),
}));

const TRACK = {
  id: "t1",
  title: "Archived",
  artist: null,
  album: null,
  genre: null,
  musical_key: null,
  bpm: 0,
  duration_secs: 0,
  rating: null,
  comment: null,
  folder_path: "/a.mp3",
  analysis_data_path: null,
  file_type: 1,
  sample_rate: 0,
  bit_rate: 0,
  release_year: null,
  dj_play_count: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function render_() {
  return render(
    <WithProviders>
      <ArchiveView
        libraryPath="/db"
        selectedTrackIds={new Set(["t1"])}
        onSelectionChange={vi.fn()}
        onSelect={vi.fn()}
      />
    </WithProviders>,
  );
}

describe("ArchiveView", () => {
  it("loads archived tracks", async () => {
    vi.mocked(listArchivedTracks).mockResolvedValue([TRACK]);
    render_();
    expect(await screen.findByText(/1 archived track/)).toBeInTheDocument();
  });

  it("unarchive button calls unarchiveTracks", async () => {
    vi.mocked(listArchivedTracks).mockResolvedValue([TRACK]);
    vi.mocked(unarchiveTracks).mockResolvedValue();
    render_();
    await screen.findByText(/1 archived track/);
    await userEvent.click(screen.getByRole("button", { name: /Unarchive/ }));
    expect(unarchiveTracks).toHaveBeenCalledWith("/db", ["t1"]);
  });

  it("delete-from-library opens confirm and stages delete", async () => {
    vi.mocked(listArchivedTracks).mockResolvedValue([TRACK]);
    vi.mocked(stageTrackDelete).mockResolvedValue(1);
    render_();
    await screen.findByText(/1 archived track/);
    await userEvent.click(
      screen.getByRole("button", { name: /Delete from library/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Stage delete" }),
    );
    expect(stageTrackDelete).toHaveBeenCalledWith("/db", ["t1"]);
  });
});
