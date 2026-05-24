import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { useState } from "react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { TagPickerModal } from "../components/TagPickerModal";

// `<dialog>` is implemented in jsdom but `showModal`/`close` are stubs that
// throw — patch them so the picker mounts cleanly.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

vi.mock("../ipc", () => ({
  listTagCategories: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
  getTrackTags: vi.fn().mockResolvedValue([]),
  addTrackTag: vi.fn(),
  removeTrackTag: vi.fn(),
}));

/**
 * Mirrors the App.tsx wiring: a `t` shortcut that opens the TagPickerModal
 * when a track is selected, and bails out otherwise.
 */
function Harness({ selectedTrackIds }: { selectedTrackIds: Set<string> }) {
  const [pickerIds, setPickerIds] = useState<Set<string> | null>(null);
  useKeyboardShortcuts([
    {
      key: "t",
      handler: (event) => {
        if (selectedTrackIds.size === 0) return;
        event.preventDefault();
        setPickerIds(new Set(selectedTrackIds));
      },
    },
  ]);
  return pickerIds ? (
    <TagPickerModal
      libraryPath="/library/master.db"
      selectedTrackIds={pickerIds}
      onClose={() => setPickerIds(null)}
    />
  ) : null;
}

function dispatchKey(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  window.dispatchEvent(event);
}

describe("T-key mounts the tag picker", () => {
  it("opens the TagPickerModal when a track is selected", async () => {
    render(<Harness selectedTrackIds={new Set(["track-1"])} />);

    expect(screen.queryByText(/Assign Tags/i)).toBeNull();

    act(() => dispatchKey("t"));

    expect(await screen.findByText(/Assign Tags/i)).toBeInTheDocument();
  });

  it("does nothing when no track is selected", () => {
    render(<Harness selectedTrackIds={new Set()} />);

    act(() => dispatchKey("t"));

    expect(screen.queryByText(/Assign Tags/i)).toBeNull();
  });
});
