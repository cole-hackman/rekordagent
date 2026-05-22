import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncPanel } from "./SyncPanel";
import { syncCheck, syncExecute, syncPreview } from "../ipc";
import { WithProviders } from "../test-utils/providers";

vi.mock("../ipc", () => ({
  listPlaylists: vi.fn().mockResolvedValue([]),
  syncCheck: vi.fn(),
  syncExecute: vi.fn(),
  syncPreview: vi.fn(),
}));

const ROW = {
  change_id: "c1",
  kind: "TrackMetadataEdit",
  track_id: "t1",
  track_title: "Some Title",
  field: "Title",
  old_value: "Old",
  new_value: "New",
  reason: null,
  updated_at: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function render_() {
  return render(
    <WithProviders>
      <SyncPanel libraryPath="/db" />
    </WithProviders>,
  );
}

describe("SyncPanel", () => {
  it("renders empty state when nothing staged", async () => {
    vi.mocked(syncCheck).mockResolvedValue({ locked: false, pending_changes: 0 });
    vi.mocked(syncPreview).mockResolvedValue([]);
    render_();
    expect(await screen.findByText(/Nothing staged/)).toBeInTheDocument();
  });

  it("shows lock banner when master.db is locked", async () => {
    vi.mocked(syncCheck).mockResolvedValue({ locked: true, pending_changes: 1 });
    vi.mocked(syncPreview).mockResolvedValue([ROW]);
    render_();
    expect(
      await screen.findByText(/Rekordbox appears to be running/),
    ).toBeInTheDocument();
  });

  it("excludes a row when its checkbox is toggled off", async () => {
    vi.mocked(syncCheck).mockResolvedValue({ locked: false, pending_changes: 1 });
    vi.mocked(syncPreview).mockResolvedValue([ROW]);
    render_();
    await screen.findByText("Some Title");
    expect(screen.getByText(/1 of 1 included/)).toBeInTheDocument();
    // First *enabled* checkbox is the row's include toggle (options block
    // contains a disabled checkbox).
    const rowCheckbox = screen
      .getAllByRole("checkbox")
      .find((el) => !(el as HTMLInputElement).disabled)!;
    await userEvent.click(rowCheckbox);
    expect(screen.getByText(/0 of 1 included/)).toBeInTheDocument();
  });

  it("Apply calls syncExecute with included change ids", async () => {
    vi.mocked(syncCheck).mockResolvedValue({ locked: false, pending_changes: 1 });
    vi.mocked(syncPreview).mockResolvedValue([ROW]);
    vi.mocked(syncExecute).mockResolvedValue({ applied: ["c1"], failed: [] });
    render_();
    await screen.findByText("Some Title");
    await userEvent.click(screen.getByRole("button", { name: /Apply 1 change/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(syncExecute).toHaveBeenCalledWith(
      "/db",
      "full",
      expect.any(Object),
      ["c1"],
    );
  });
});
