import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomTagsPanel } from "./CustomTagsPanel";
import { listTagCategories, listTags } from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", async () => {
  const actual = await vi.importActual<typeof import("../ipc")>("../ipc");
  return {
    ...actual,
    listTagCategories: vi.fn(),
    listTags: vi.fn(),
    createTagCategory: vi.fn(),
    createTag: vi.fn(),
    deleteTag: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function render_(props: Partial<React.ComponentProps<typeof CustomTagsPanel>> = {}) {
  return render(
    <WithProviders>
      <CustomTagsPanel {...props} />
    </WithProviders>,
  );
}

describe("CustomTagsPanel", () => {
  it("renders a usage count badge when a tag has tracks", async () => {
    vi.mocked(listTagCategories).mockResolvedValue([
      { id: "c1", name: "Mood", seq: 0 },
    ]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", category_id: "c1", name: "Chill", seq: 0, usage_count: 7 },
      { id: "t2", category_id: "c1", name: "Hype", seq: 1, usage_count: 0 },
    ]);

    render_();

    // Category collapsed by default; expand it.
    await userEvent.click(await screen.findByText("Mood"));
    expect(await screen.findByText("Chill")).toBeInTheDocument();
    expect(screen.getByText("(7)")).toBeInTheDocument();
    // Tag with no bindings should not render a "(0)" badge.
    expect(screen.queryByText("(0)")).toBeNull();
  });

  it("renders a 'Show tracks' button after selecting tags and calls onShowTracks", async () => {
    vi.mocked(listTagCategories).mockResolvedValue([
      { id: "c1", name: "Mood", seq: 0 },
    ]);
    vi.mocked(listTags).mockResolvedValue([
      { id: "t1", category_id: "c1", name: "Chill", seq: 0, usage_count: 3 },
    ]);

    const onShowTracks = vi.fn();
    render_({ onShowTracks });

    await userEvent.click(await screen.findByText("Mood"));
    const chip = await screen.findByRole("button", { name: /^Chill/ });
    await userEvent.click(chip);

    const showBtn = await screen.findByRole("button", { name: /show 1 tag/i });
    await userEvent.click(showBtn);
    expect(onShowTracks).toHaveBeenCalledWith(["t1"]);
  });
});
