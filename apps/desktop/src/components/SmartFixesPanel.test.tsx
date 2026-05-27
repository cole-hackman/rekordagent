import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmartFixesPanel } from "./SmartFixesPanel";
import { smartFixApply, smartFixPreview } from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", async () => {
  const actual = await vi.importActual<typeof import("../ipc")>("../ipc");
  return {
    ...actual,
    smartFixPreview: vi.fn(),
    smartFixApply: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function render_() {
  return render(
    <WithProviders>
      <SmartFixesPanel libraryPath="/db" />
    </WithProviders>,
  );
}

describe("SmartFixesPanel", () => {
  it("lists all 11 fix cards collapsed by default", () => {
    render_();
    expect(screen.getByText("Fix Casing")).toBeInTheDocument();
    expect(screen.getByText("Remove URLs")).toBeInTheDocument();
    expect(screen.getByText("Add Mix Parentheses")).toBeInTheDocument();
    // Scan button should not be visible until a card is expanded.
    expect(screen.queryByRole("button", { name: /^Scan$/ })).toBeNull();
  });

  it("expands a card and scans for proposals", async () => {
    vi.mocked(smartFixPreview).mockResolvedValue([
      {
        id: "p1",
        track_id: "t1",
        track_title: "BIG TITLE",
        field: "Title",
        old_value: "BIG TITLE",
        new_value: "Big Title",
      },
    ]);
    render_();
    await userEvent.click(screen.getByText("Fix Casing"));
    await userEvent.click(screen.getByRole("button", { name: "Scan" }));
    expect(smartFixPreview).toHaveBeenCalledWith("/db", "fix_casing");
    // Title shows in both the Track and Old columns — match any.
    expect((await screen.findAllByText("BIG TITLE")).length).toBeGreaterThan(0);
    expect(screen.getByText("Big Title")).toBeInTheDocument();
  });

  it("Stage button calls smartFixApply with kept ids", async () => {
    vi.mocked(smartFixPreview).mockResolvedValue([
      {
        id: "p1",
        track_id: "t1",
        track_title: "Track X",
        field: "Title",
        old_value: "x",
        new_value: "X",
      },
    ]);
    vi.mocked(smartFixApply).mockResolvedValue(1);
    render_();
    await userEvent.click(screen.getByText("Fix Casing"));
    await userEvent.click(screen.getByRole("button", { name: "Scan" }));
    await screen.findByText("Track X");
    await userEvent.click(
      screen.getByRole("button", { name: /Stage 1 change/ }),
    );
    expect(smartFixApply).toHaveBeenCalledWith("/db", "fix_casing", ["p1"]);
  });
});
