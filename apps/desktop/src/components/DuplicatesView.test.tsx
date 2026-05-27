import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicatesView } from "./DuplicatesView";
import { archiveTracks, listLibraryDuplicateGroups } from "../ipc";
import { WithProviders } from "../test-utils/providers";
import type { DuplicateGroup, Track } from "../types";

vi.mock("../ipc", () => ({
  listLibraryDuplicateGroups: vi.fn(),
  archiveTracks: vi.fn(),
}));

function track(id: string, title: string): Track {
  return {
    id,
    title,
    artist: "Artist",
    album: null,
    genre: null,
    musical_key: null,
    bpm: 128,
    duration_secs: 300,
    rating: null,
    comment: null,
    folder_path: `/music/${id}.mp3`,
    analysis_data_path: null,
    file_type: 1,
    sample_rate: null,
    bit_rate: null,
    release_year: null,
    dj_play_count: null,
    energy: null,
  };
}

const GROUPS: DuplicateGroup[] = [
  {
    title: "Strobe",
    artist: "Deadmau5",
    tracks: [track("e1", "Strobe"), track("e2", "Strobe")],
    kind: "ExactTitleArtist",
    confidence: 1.0,
  },
  {
    title: "Anthem",
    artist: "A",
    tracks: [
      track("f1", "Anthem"),
      track("f2", "Anthem (Original Mix)"),
      track("f3", "Anthem (Extended)"),
    ],
    kind: "FuzzyTitle",
    confidence: 0.85,
  },
  {
    title: "Sample (Audio Match)",
    artist: "X",
    tracks: [track("a1", "Sample A"), track("a2", "Sample B")],
    kind: "AudioFingerprint",
    confidence: 0.93,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function render_() {
  return render(
    <WithProviders>
      <DuplicatesView libraryPath="/db" onOpenInspector={vi.fn()} />
    </WithProviders>,
  );
}

describe("DuplicatesView", () => {
  it("renders one section per group with kind labels", async () => {
    vi.mocked(listLibraryDuplicateGroups).mockResolvedValue(GROUPS);
    render_();
    const sections = await screen.findAllByTestId("duplicate-group");
    expect(sections).toHaveLength(3);
    expect(screen.getByText("Exact title + artist")).toBeInTheDocument();
    expect(screen.getByText("Fuzzy title match")).toBeInTheDocument();
    expect(screen.getByText("Audio fingerprint match")).toBeInTheDocument();
  });

  it("archives the non-kept tracks when Keep one, archive rest is clicked", async () => {
    vi.mocked(listLibraryDuplicateGroups).mockResolvedValue([GROUPS[1]]);
    vi.mocked(archiveTracks).mockResolvedValue(undefined);
    render_();
    const section = await screen.findByTestId("duplicate-group");
    // Default keep = first track (f1). Pick the first track explicitly anyway
    // to confirm the radio control is wired.
    const radios = within(section).getAllByRole("radio");
    await userEvent.click(radios[0]);
    await userEvent.click(within(section).getByTestId("archive-rest"));
    expect(archiveTracks).toHaveBeenCalledWith("/db", ["f2", "f3"]);
  });

  it("renders empty state when no duplicates exist", async () => {
    vi.mocked(listLibraryDuplicateGroups).mockResolvedValue([]);
    render_();
    expect(
      await screen.findByText(/No duplicate candidates found/i),
    ).toBeInTheDocument();
  });

  it("Open in inspector callback fires per row", async () => {
    vi.mocked(listLibraryDuplicateGroups).mockResolvedValue([GROUPS[0]]);
    const onOpen = vi.fn();
    render(
      <WithProviders>
        <DuplicatesView libraryPath="/db" onOpenInspector={onOpen} />
      </WithProviders>,
    );
    const buttons = await screen.findAllByTestId("open-inspector");
    await userEvent.click(buttons[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].id).toBe("e1");
  });
});
