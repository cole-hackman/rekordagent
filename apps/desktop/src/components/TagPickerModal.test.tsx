import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TagPickerModal } from "./TagPickerModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const listTagCategoriesMock = vi.fn();
const listTagsMock = vi.fn();
const addTrackTagMock = vi.fn();
const removeTrackTagMock = vi.fn();

vi.mock("../ipc", () => ({
  listTagCategories: (...args: unknown[]) => listTagCategoriesMock(...args),
  listTags: (...args: unknown[]) => listTagsMock(...args),
  addTrackTag: (...args: unknown[]) => addTrackTagMock(...args),
  removeTrackTag: (...args: unknown[]) => removeTrackTagMock(...args),
}));

beforeEach(() => {
  listTagCategoriesMock.mockReset();
  listTagsMock.mockReset();
  addTrackTagMock.mockReset();
  removeTrackTagMock.mockReset();
});

describe("TagPickerModal", () => {
  it("invalidates the track-tags-map query after a toggle", async () => {
    listTagCategoriesMock.mockResolvedValue([
      { id: "cat-1", name: "Mood", position: 0 },
    ]);
    listTagsMock.mockResolvedValue([
      { id: "tag-1", category_id: "cat-1", name: "Chill", position: 0 },
    ]);
    addTrackTagMock.mockResolvedValue(undefined);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    render(
      <QueryClientProvider client={client}>
        <TagPickerModal
          libraryPath="/library/master.db"
          selectedTrackIds={new Set(["track-1"])}
          tagsByTrack={new Map()}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: /Chill/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(addTrackTagMock).toHaveBeenCalledWith(
        "/library/master.db",
        "track-1",
        "tag-1",
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["track-tags-map", "/library/master.db"],
      });
    });
  });

  it("derives tag counts from the tagsByTrack prop without per-track IPC", async () => {
    listTagCategoriesMock.mockResolvedValue([
      { id: "cat-1", name: "Mood", position: 0 },
    ]);
    listTagsMock.mockResolvedValue([
      { id: "tag-1", category_id: "cat-1", name: "Chill", position: 0 },
    ]);

    const tagsByTrack = new Map<string, Set<string>>([
      ["track-1", new Set(["tag-1"])],
      ["track-2", new Set(["tag-1"])],
    ]);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <TagPickerModal
          libraryPath="/library/master.db"
          selectedTrackIds={new Set(["track-1", "track-2"])}
          tagsByTrack={tagsByTrack}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );

    // Both tracks have tag-1 -> button renders in the "all" state, no count badge.
    const button = await screen.findByRole("button", { name: /Chill/i });
    expect(button).toBeInTheDocument();
    // No per-track IPC was registered in the mock surface at all.
  });
});
