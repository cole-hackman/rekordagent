import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiffReviewPanel } from "./DiffReviewPanel";
import { acceptChange, listChanges, rejectChange } from "../ipc";

vi.mock("../ipc", () => ({
  listChanges: vi.fn(),
  acceptChange: vi.fn(),
  rejectChange: vi.fn(),
  acceptAllSafe: vi.fn(),
  rejectAll: vi.fn(),
  exportAcceptedChanges: vi.fn(),
}));

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DiffReviewPanel libraryPath="/db" onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DiffReviewPanel", () => {
  it("renders proposed changes with old and new values", async () => {
    vi.mocked(listChanges).mockResolvedValue([
      {
        id: "change-1",
        library_path: "/db",
        kind: "TrackMetadataEdit",
        target_id: "track-1",
        field: "genre",
        old_value: "House",
        new_value: "Deep House",
        reason: "Normalize genre",
        confidence: 0.92,
        status: "Proposed",
        created_at: 1,
        updated_at: 1,
      },
    ]);

    renderPanel();

    expect(await screen.findByText("genre")).toBeInTheDocument();
    expect(screen.getByText("House")).toBeInTheDocument();
    expect(screen.getByText("Deep House")).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/)).toBeInTheDocument();
  });

  it("accepts and rejects individual proposed changes", async () => {
    vi.mocked(listChanges).mockResolvedValue([
      {
        id: "change-1",
        library_path: "/db",
        kind: "TrackMetadataEdit",
        target_id: "track-1",
        field: "genre",
        old_value: "House",
        new_value: "Deep House",
        reason: null,
        confidence: null,
        status: "Proposed",
        created_at: 1,
        updated_at: 1,
      },
    ]);
    vi.mocked(acceptChange).mockResolvedValue({} as never);
    vi.mocked(rejectChange).mockResolvedValue({} as never);

    renderPanel();
    await screen.findByText("genre");

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(acceptChange).toHaveBeenCalledWith(
      "change-1",
      expect.any(Object),
    );

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(rejectChange).toHaveBeenCalledWith(
      "change-1",
      expect.any(Object),
    );
  });

  it("shows an empty state", async () => {
    vi.mocked(listChanges).mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(listChanges).toHaveBeenCalledWith("/db"));
    expect(await screen.findByText("No proposed changes")).toBeInTheDocument();
  });

  it("groups changes by target and filters by status", async () => {
    vi.mocked(listChanges).mockResolvedValue([
      {
        id: "change-1",
        library_path: "/db",
        kind: "TrackMetadataEdit",
        target_id: "track-1",
        field: "genre",
        old_value: "House",
        new_value: "Deep House",
        reason: null,
        confidence: null,
        status: "Proposed",
        created_at: 1,
        updated_at: 1,
      },
      {
        id: "change-2",
        library_path: "/db",
        kind: "TrackMetadataEdit",
        target_id: "track-2",
        field: "artist",
        old_value: "Unknown",
        new_value: "DJ Two",
        reason: null,
        confidence: null,
        status: "Accepted",
        created_at: 1,
        updated_at: 1,
      },
    ]);

    renderPanel();

    expect(await screen.findByText("Target: track-1")).toBeInTheDocument();
    expect(screen.queryByText("Target: track-2")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Accepted: 1" }));
    expect(await screen.findByText("Target: track-2")).toBeInTheDocument();
    expect(screen.queryByText("Target: track-1")).toBeNull();
  });
});
