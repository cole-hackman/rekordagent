import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Track, HotCue } from "../types";

vi.mock("../hooks/useTrackCues");
import { useTrackCues } from "../hooks/useTrackCues";

import { TrackDetailPanel } from "./TrackDetailPanel";

const BASE_TRACK: Track = {
  id: "1",
  title: "Dark Matter",
  artist: "Surgeon",
  album: "Force + Form",
  genre: "Techno",
  musical_key: "8A",
  bpm: 140.0,
  duration_secs: 360,
  rating: 3,
  comment: "Opener banger",
  folder_path: "/music/dark-matter.mp3",
  analysis_data_path: null,
  file_type: null,
  sample_rate: null,
  bit_rate: null,
  release_year: 2014,
  dj_play_count: 5,
};

const CUES: HotCue[] = [
  { id: "1", content_id: "1", in_msec: 8000, out_msec: null, kind: { HotCue: 1 }, color: null, comment: "Intro" },
  { id: "2", content_id: "1", in_msec: 45000, out_msec: null, kind: "MemoryCue", color: null, comment: null },
  { id: "3", content_id: "1", in_msec: 120500, out_msec: null, kind: { HotCue: 2 }, color: null, comment: "Drop" },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(useTrackCues).mockReturnValue({
    data: CUES,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useTrackCues>);
});

describe("TrackDetailPanel", () => {
  it("displays track title and artist", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("Dark Matter")).toBeInTheDocument();
    expect(screen.getByText("Surgeon")).toBeInTheDocument();
  });

  it("displays metadata fields", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("Force + Form")).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("140.0")).toBeInTheDocument();
    expect(screen.getByText("8A")).toBeInTheDocument();
    expect(screen.getByText("6:00")).toBeInTheDocument();
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("displays comment", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("Opener banger")).toBeInTheDocument();
  });

  it("displays cue timestamps formatted as M:SS.s", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("0:08.0")).toBeInTheDocument();
    expect(screen.getByText("0:45.0")).toBeInTheDocument();
    expect(screen.getByText("2:00.5")).toBeInTheDocument();
  });

  it("shows slot labels for hot cues and memory cue", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows cue comments", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Drop")).toBeInTheDocument();
  });

  it("shows 'No cues.' when cue list is empty", () => {
    vi.mocked(useTrackCues).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTrackCues>);
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByText("No cues.")).toBeInTheDocument();
  });

  it("shows rating stars", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByLabelText("3 stars")).toBeInTheDocument();
  });

  it("shows waveform placeholder", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={() => {}} />);
    expect(screen.getByText("Audio Preview")).toBeInTheDocument();
  });

  it("shows play button when not playing", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("shows pause button when playing", () => {
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={true} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("calls onTogglePlay when play button is clicked", () => {
    const onTogglePlay = vi.fn();
    render(<TrackDetailPanel track={BASE_TRACK} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={onTogglePlay} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it("disables play button when track has no folder_path", () => {
    const noPathTrack = { ...BASE_TRACK, folder_path: null };
    render(<TrackDetailPanel track={noPathTrack} libraryPath="/tmp/master.db" isPlaying={false} onTogglePlay={vi.fn()} />, { wrapper });
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });
});
