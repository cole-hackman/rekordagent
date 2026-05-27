import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CleanupPanel } from "./CleanupPanel";
import {
  listGenres,
  listArtists,
  renameGenre,
  renameArtist,
  deleteGenre,
  deleteArtist,
} from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", async () => {
  const actual = await vi.importActual<typeof import("../ipc")>("../ipc");
  return {
    ...actual,
    listGenres: vi.fn(),
    listArtists: vi.fn(),
    renameGenre: vi.fn(),
    renameArtist: vi.fn(),
    deleteGenre: vi.fn(),
    deleteArtist: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function render_(
  props: Partial<React.ComponentProps<typeof CleanupPanel>> = {},
) {
  return render(
    <WithProviders>
      <CleanupPanel mode="genre" libraryPath="/db" {...props} />
    </WithProviders>,
  );
}

describe("CleanupPanel (genre)", () => {
  it("lists genres with counts", async () => {
    vi.mocked(listGenres).mockResolvedValue([
      { genre: "House", count: 42 },
      { genre: "Techno", count: 17 },
      { genre: "Drum & Bass", count: 5 },
    ]);

    render_();

    expect(listGenres).toHaveBeenCalledWith("/db");
    expect(await screen.findByText("House")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("Drum & Bass")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renames a selected genre via rename_genre", async () => {
    vi.mocked(listGenres).mockResolvedValue([
      { genre: "House", count: 42 },
      { genre: "Techno", count: 17 },
    ]);
    vi.mocked(renameGenre).mockResolvedValue({
      affected_tracks: 42,
      staged_change_ids: ["c1"],
    });

    render_();

    const chip = await screen.findByRole("button", { name: /^House/ });
    await userEvent.click(chip);

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    // Prompt dialog appears — type new name and confirm.
    const input = await screen.findByPlaceholderText("New genre name");
    await userEvent.type(input, "Deep House");
    await userEvent.click(
      screen.getByRole("button", { name: "Stage rename" }),
    );

    expect(renameGenre).toHaveBeenCalledWith("/db", "House", "Deep House");
  });

  it("stages deletion for two genres selected via meta+click", async () => {
    vi.mocked(listGenres).mockResolvedValue([
      { genre: "House", count: 42 },
      { genre: "Techno", count: 17 },
      { genre: "Trance", count: 9 },
    ]);
    vi.mocked(deleteGenre).mockResolvedValue({
      affected_tracks: 17,
      staged_change_ids: ["c2"],
    });

    render_();

    const houseChip = await screen.findByRole("button", { name: /^House/ });
    const technoChip = screen.getByRole("button", { name: /^Techno/ });
    await userEvent.click(houseChip);
    // Shift-click to add to selection (component checks shiftKey || metaKey).
    const user = userEvent.setup();
    await user.keyboard("{Shift>}");
    await user.click(technoChip);
    await user.keyboard("{/Shift}");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    // Destructive confirm dialog.
    await userEvent.click(
      await screen.findByRole("button", { name: "Stage deletion" }),
    );

    expect(deleteGenre).toHaveBeenCalledTimes(2);
    expect(deleteGenre).toHaveBeenCalledWith("/db", "House");
    expect(deleteGenre).toHaveBeenCalledWith("/db", "Techno");
  });

  it("disables Rename/Delete when nothing is selected", async () => {
    vi.mocked(listGenres).mockResolvedValue([{ genre: "House", count: 1 }]);
    render_();
    await screen.findByText("House");
    expect(
      screen.getByRole("button", { name: "Rename" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete" }),
    ).toBeDisabled();
  });

  it("shows empty-state copy when no genres exist", async () => {
    vi.mocked(listGenres).mockResolvedValue([]);
    render_();
    expect(await screen.findByText("No genres found.")).toBeInTheDocument();
  });
});

describe("CleanupPanel (artist)", () => {
  it("uses listArtists / renameArtist when mode=artist", async () => {
    vi.mocked(listArtists).mockResolvedValue([
      { artist: "DJ One", count: 12 },
      { artist: "DJ Two", count: 4 },
    ]);
    vi.mocked(renameArtist).mockResolvedValue({
      affected_tracks: 12,
      staged_change_ids: ["a1"],
    });

    render_({ mode: "artist" });

    expect(listArtists).toHaveBeenCalledWith("/db");
    expect(listGenres).not.toHaveBeenCalled();

    const chip = await screen.findByRole("button", { name: /^DJ One/ });
    await userEvent.click(chip);

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = await screen.findByPlaceholderText("New artist name");
    await userEvent.type(input, "DJ Uno");
    await userEvent.click(
      screen.getByRole("button", { name: "Stage rename" }),
    );

    expect(renameArtist).toHaveBeenCalledWith("/db", "DJ One", "DJ Uno");
    expect(renameGenre).not.toHaveBeenCalled();
  });

  it("calls delete_artist when mode=artist and Delete is confirmed", async () => {
    vi.mocked(listArtists).mockResolvedValue([
      { artist: "DJ Solo", count: 3 },
    ]);
    vi.mocked(deleteArtist).mockResolvedValue({
      affected_tracks: 3,
      staged_change_ids: ["a2"],
    });

    render_({ mode: "artist" });

    await userEvent.click(
      await screen.findByRole("button", { name: /^DJ Solo/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Stage deletion" }),
    );

    expect(deleteArtist).toHaveBeenCalledWith("/db", "DJ Solo");
    expect(deleteGenre).not.toHaveBeenCalled();
  });
});
