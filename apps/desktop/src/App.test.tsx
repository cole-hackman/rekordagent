import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import App from "./App";

vi.mock("./ipc", () => ({
  getLibraryPath: vi.fn().mockResolvedValue(null),
  validateLibraryPath: vi.fn(),
}));

const mockState = {
  libraryPath: null as string | null,
  trackCount: null as number | null,
  setLibraryConfigured: vi.fn(),
};

vi.mock("./store/appStore", () => ({
  useAppStore: vi.fn().mockImplementation((selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ),
}));

describe("App", () => {
  it("shows first-run wizard when no library is configured", async () => {
    render(<App />);
    await screen.findByText("Welcome to decks");
  });
});
