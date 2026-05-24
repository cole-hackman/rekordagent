import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Track } from "../types";

// Must be declared before other mocks so hoisting order is safe.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * estimateSize(),
        end: (i + 1) * estimateSize(),
        size: estimateSize(),
        lane: 0,
        key: i,
      })),
    getTotalSize: () => count * estimateSize(),
    measureElement: () => {},
  }),
}));

vi.mock("../hooks/useLibrary");
import { useLibrary } from "../hooks/useLibrary";

import { TrackTable } from "./TrackTable";
import { EMPTY_FILTERS, type Filters, type FilterContext } from "../lib/filters";

const EMPTY_CTX: FilterContext = {
  tracksWithCues: new Set(),
  tracksInAnyPlaylist: new Set(),
  tracksWithMissingFiles: new Set(),
  tagsByTrack: new Map(),
};

const withQuery = (q: string): Filters => ({ ...EMPTY_FILTERS, query: q });

const TRACKS: Track[] = [
  {
    id: "1",
    title: "Dark Matter",
    artist: "Surgeon",
    album: null,
    genre: "Techno",
    musical_key: "8A",
    bpm: 140.0,
    duration_secs: 360,
    rating: null,
    comment: null,
    folder_path: null,
    analysis_data_path: null,
    file_type: null,
    sample_rate: null,
    bit_rate: null,
    release_year: null,
    dj_play_count: null,
  },
  {
    id: "2",
    title: "Acid Rain",
    artist: "Aphex Twin",
    album: null,
    genre: "Ambient",
    musical_key: "11B",
    bpm: 130.5,
    duration_secs: 240,
    rating: null,
    comment: null,
    folder_path: null,
    analysis_data_path: null,
    file_type: null,
    sample_rate: null,
    bit_rate: null,
    release_year: null,
    dj_play_count: null,
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(useLibrary).mockReturnValue({
    data: TRACKS,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useLibrary>);
});

describe("TrackTable", () => {
  it("renders track titles", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={EMPTY_FILTERS} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("Dark Matter")).toBeInTheDocument();
    expect(screen.getByText("Acid Rain")).toBeInTheDocument();
  });

  it("renders artist names", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={EMPTY_FILTERS} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("Surgeon")).toBeInTheDocument();
    expect(screen.getByText("Aphex Twin")).toBeInTheDocument();
  });

  it("renders BPM formatted to one decimal", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={EMPTY_FILTERS} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("140.0")).toBeInTheDocument();
    expect(screen.getByText("130.5")).toBeInTheDocument();
  });

  it("renders duration as M:SS", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={EMPTY_FILTERS} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("6:00")).toBeInTheDocument();
    expect(screen.getByText("4:00")).toBeInTheDocument();
  });

  it("filters tracks by title", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={withQuery("dark")} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("Dark Matter")).toBeInTheDocument();
    expect(screen.queryByText("Acid Rain")).not.toBeInTheDocument();
  });

  it("filters tracks by artist", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={withQuery("aphex")} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.queryByText("Dark Matter")).not.toBeInTheDocument();
    expect(screen.getByText("Acid Rain")).toBeInTheDocument();
  });

  it("shows empty state when filters match nothing", () => {
    render(
      <TrackTable libraryPath="/tmp/master.db" filters={withQuery("zzznomatch")} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />,
      { wrapper },
    );
    expect(
      screen.getByText("No tracks match your filters"),
    ).toBeInTheDocument();
  });

  it("shows column headers", () => {
    render(<TrackTable libraryPath="/tmp/master.db" filters={EMPTY_FILTERS} filterCtx={EMPTY_CTX} selectedTrackIds={new Set()} onSelectionChange={vi.fn()} onSelect={vi.fn()} />, { wrapper });
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
    expect(screen.getByText("BPM")).toBeInTheDocument();
    expect(screen.getByText("Key")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Genre")).toBeInTheDocument();
  });
});
