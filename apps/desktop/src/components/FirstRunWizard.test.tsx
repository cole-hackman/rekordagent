import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirstRunWizard } from "./FirstRunWizard";

vi.mock("../ipc", () => ({
  pickLibraryPath: vi.fn(),
  validateLibraryPath: vi.fn(),
  setLibraryPath: vi.fn(),
}));

vi.mock("../store/appStore", () => ({
  useAppStore: (selector: (s: { setLibraryConfigured: () => void }) => unknown) =>
    selector({ setLibraryConfigured: vi.fn() }),
}));

import * as ipc from "../ipc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FirstRunWizard", () => {
  it("shows welcome step on mount", () => {
    render(<FirstRunWizard />);
    expect(screen.getByText("Welcome to decks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("advances to pick step after clicking Get started", () => {
    render(<FirstRunWizard />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText("Locate your library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
  });

  it("shows validating then done on successful browse", async () => {
    vi.mocked(ipc.pickLibraryPath).mockResolvedValue("/tmp/master.db");
    vi.mocked(ipc.validateLibraryPath).mockResolvedValue(1234);
    vi.mocked(ipc.setLibraryPath).mockResolvedValue(undefined);

    render(<FirstRunWizard />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));

    await waitFor(() => {
      expect(screen.getByText("Library connected")).toBeInTheDocument();
    });
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
    expect(ipc.setLibraryPath).toHaveBeenCalledWith("/tmp/master.db");
  });

  it("shows error step when validation fails", async () => {
    vi.mocked(ipc.pickLibraryPath).mockResolvedValue("/tmp/bad.db");
    vi.mocked(ipc.validateLibraryPath).mockRejectedValue(
      new Error("Not a valid Rekordbox database")
    );

    render(<FirstRunWizard />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });
    expect(screen.getByText("Not a valid Rekordbox database")).toBeInTheDocument();
  });

  it("retry from error returns to pick step", async () => {
    vi.mocked(ipc.pickLibraryPath).mockResolvedValue("/tmp/bad.db");
    vi.mocked(ipc.validateLibraryPath).mockRejectedValue(new Error("bad"));

    render(<FirstRunWizard />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));

    await waitFor(() => screen.getByText("Validation failed"));
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("Locate your library")).toBeInTheDocument();
  });

  it("does nothing when file picker is cancelled", async () => {
    vi.mocked(ipc.pickLibraryPath).mockResolvedValue(null);

    render(<FirstRunWizard />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /browse/i }));

    await waitFor(() => {
      // Should stay on pick step — no validation triggered.
      expect(screen.getByText("Locate your library")).toBeInTheDocument();
    });
    expect(ipc.validateLibraryPath).not.toHaveBeenCalled();
  });
});
