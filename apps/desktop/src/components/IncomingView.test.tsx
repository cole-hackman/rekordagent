import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncomingView } from "./IncomingView";
import {
  archiveTracks,
  clearIncoming,
  listIncomingTracks,
} from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", () => ({
  listIncomingTracks: vi.fn(),
  clearIncoming: vi.fn(),
  archiveTracks: vi.fn(),
  // Touched transitively via useFilterContext / TrackTable:
  listTracksWithCues: vi.fn().mockResolvedValue([]),
  listTracksInAnyPlaylist: vi.fn().mockResolvedValue([]),
  listTracksWithMissingFiles: vi.fn().mockResolvedValue([]),
  listTracks: vi.fn().mockResolvedValue([]),
}));

const TRACK = {
  id: "t1",
  title: "Fresh Track",
  artist: "X",
  album: null,
  genre: null,
  musical_key: null,
  bpm: 128,
  duration_secs: 200,
  rating: null,
  comment: null,
  folder_path: "/x.mp3",
  analysis_data_path: null,
  file_type: 1,
  sample_rate: 44100,
  bit_rate: 320,
  release_year: null,
  dj_play_count: null,
  energy: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function render_() {
  return render(
    <WithProviders>
      <IncomingView
        libraryPath="/db"
        selectedTrackIds={new Set(["t1"])}
        onSelectionChange={vi.fn()}
        onSelect={vi.fn()}
      />
    </WithProviders>,
  );
}

describe("IncomingView", () => {
  it("fetches and renders incoming tracks on mount", async () => {
    vi.mocked(listIncomingTracks).mockResolvedValue([TRACK]);
    render_();
    expect(await screen.findByText(/1 new track/)).toBeInTheDocument();
    expect(listIncomingTracks).toHaveBeenCalledWith("/db");
  });

  it("archive-selected button calls archiveTracks", async () => {
    vi.mocked(listIncomingTracks).mockResolvedValue([TRACK]);
    vi.mocked(archiveTracks).mockResolvedValue();
    render_();
    await screen.findByText(/1 new track/);
    await userEvent.click(screen.getByRole("button", { name: /Archive selected/ }));
    expect(archiveTracks).toHaveBeenCalledWith("/db", ["t1"]);
  });

  it("mark-all-reviewed opens a confirm and calls clearIncoming on Confirm", async () => {
    vi.mocked(listIncomingTracks).mockResolvedValue([TRACK]);
    vi.mocked(clearIncoming).mockResolvedValue();
    render_();
    await screen.findByText(/1 new track/);
    await userEvent.click(screen.getByRole("button", { name: /Mark all reviewed/ }));
    // Dialog opens — click its Clear button
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(clearIncoming).toHaveBeenCalledWith("/db");
  });
});
