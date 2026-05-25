import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackMatcherView } from "./TrackMatcherView";
import { createPlaylistFromTracks, matchTracks, parseCsvForMatcher } from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", () => ({
  matchTracks: vi.fn(),
  createPlaylistFromTracks: vi.fn(),
  parseCsvForMatcher: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("CSV upload shows column mapping UI and delegates parse to backend", async () => {
    vi.mocked(parseCsvForMatcher).mockResolvedValue([
      { title: "Strobe", artist: "Deadmau5" },
    ]);
    vi.mocked(matchTracks).mockResolvedValue([
      {
        input_title: "Strobe",
        input_artist: "Deadmau5",
        track: { id: "t1", title: "Strobe", artist: "Deadmau5" },
        score: 1.0,
        status: "Exact",
      },
    ]);
    render_();
    // Switch source to CSV via the source dropdown.
    const sourceSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(sourceSelect, "csv");

    // Upload a CSV file.
    const csv = "title,artist\nStrobe,Deadmau5\n";
    const file = new File([csv], "list.csv", { type: "text/csv" });
    // jsdom's File doesn't implement .text() in this version — stub it.
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(csv),
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(input, file);

    // Column-mapping UI surfaces headers.
    expect(await screen.findByText(/1 rows · 2 columns/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Match" }));

    expect(parseCsvForMatcher).toHaveBeenCalledWith(csv, "title", "artist");
    expect(matchTracks).toHaveBeenCalledWith("/db", [
      { title: "Strobe", artist: "Deadmau5" },
    ]);
    expect(await screen.findByText(/1 \/ 1 tracks matched/)).toBeInTheDocument();
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
