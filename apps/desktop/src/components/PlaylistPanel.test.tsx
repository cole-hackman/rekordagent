import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlaylistPanel } from "./PlaylistPanel";
import { getPlaylist, listPlaylists } from "../ipc";

vi.mock("../ipc", () => ({
  listPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listPlaylists).mockResolvedValue([
    { id: "2", name: "Techno Set", kind: "Playlist", parent_id: "1", seq: 1 },
    { id: "3", name: "House Vibes", kind: "Playlist", parent_id: "1", seq: 2 },
  ]);
  vi.mocked(getPlaylist).mockResolvedValue({
    playlist: { id: "2", name: "Techno Set", kind: "Playlist", parent_id: "1", seq: 1 },
    tracks: [
      {
        id: "1",
        title: "Dark Matter",
        artist: "Surgeon",
        album: null,
        genre: "Techno",
        musical_key: "8A",
        bpm: 140,
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
    ],
  });
});

describe("PlaylistPanel", () => {
  it("renders playlists and selected playlist tracks", async () => {
    render(<PlaylistPanel libraryPath="/db" />, { wrapper });
    expect(await screen.findByText("Techno Set")).toBeInTheDocument();
    expect(await screen.findByText("Dark Matter")).toBeInTheDocument();
  });

  it("filters playlists by name", async () => {
    render(<PlaylistPanel libraryPath="/db" />, { wrapper });
    await screen.findByText("Techno Set");
    fireEvent.change(screen.getByPlaceholderText("Filter playlists…"), {
      target: { value: "house" },
    });
    expect(screen.queryByText("Techno Set")).not.toBeInTheDocument();
    expect(screen.getByText("House Vibes")).toBeInTheDocument();
  });

  it("loads tracks when selecting a playlist", async () => {
    render(<PlaylistPanel libraryPath="/db" />, { wrapper });
    fireEvent.click(await screen.findByText("House Vibes"));
    expect(getPlaylist).toHaveBeenCalledWith("/db", "3");
  });
});
