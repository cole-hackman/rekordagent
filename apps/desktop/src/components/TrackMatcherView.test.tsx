import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackMatcherView } from "./TrackMatcherView";
import { createPlaylistFromTracks, matchTracks } from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", () => ({
  matchTracks: vi.fn(),
  createPlaylistFromTracks: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function render_() {
  return render(
    <WithProviders>
      <TrackMatcherView libraryPath="/db" />
    </WithProviders>,
  );
}

describe("TrackMatcherView", () => {
  it("parses pasted lines and calls matchTracks", async () => {
    vi.mocked(matchTracks).mockResolvedValue([
      {
        input_title: "Title",
        input_artist: "Artist",
        track: { id: "t1", title: "Title", artist: "Artist" },
        score: 1.0,
        status: "Exact",
      },
    ]);
    render_();
    const textarea = screen.getByPlaceholderText(/Artist - Title/);
    await userEvent.type(textarea, "Artist - Title");
    await userEvent.click(screen.getByRole("button", { name: "Match" }));
    expect(matchTracks).toHaveBeenCalledWith("/db", [
      { title: "Title", artist: "Artist" },
    ]);
    expect(await screen.findByText(/1 \/ 1 tracks matched/)).toBeInTheDocument();
  });

  it("treats a line without ' - ' as just a title", async () => {
    vi.mocked(matchTracks).mockResolvedValue([
      {
        input_title: "Lone Title",
        input_artist: null,
        track: null,
        score: 0,
        status: "Unmatched",
      },
    ]);
    render_();
    await userEvent.type(
      screen.getByPlaceholderText(/Artist - Title/),
      "Lone Title",
    );
    await userEvent.click(screen.getByRole("button", { name: "Match" }));
    expect(matchTracks).toHaveBeenCalledWith("/db", [{ title: "Lone Title" }]);
  });

  it("Create playlist prompts for name and stages", async () => {
    vi.mocked(matchTracks).mockResolvedValue([
      {
        input_title: "A",
        input_artist: null,
        track: { id: "t1", title: "A", artist: null },
        score: 1.0,
        status: "Exact",
      },
    ]);
    vi.mocked(createPlaylistFromTracks).mockResolvedValue("pl-new");
    render_();
    await userEvent.type(screen.getByPlaceholderText(/Artist - Title/), "A");
    await userEvent.click(screen.getByRole("button", { name: "Match" }));
    await screen.findByText(/1 \/ 1 tracks matched/);
    await userEvent.click(
      screen.getByRole("button", { name: /Create playlist/ }),
    );
    // Dialog prompt input has a default value; click OK.
    await userEvent.click(await screen.findByRole("button", { name: "OK" }));
    expect(createPlaylistFromTracks).toHaveBeenCalledWith(
      "/db",
      "Imported (paste)",
      ["t1"],
    );
  });
});
