import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";

// Mock useAgent so we control messages/isStreaming without hitting the API
const mockSendMessage = vi.fn();
const mockClearMessages = vi.fn();
let agentState = {
  messages: [] as import("../agent/types").ChatMessage[],
  isStreaming: false,
  error: null as string | null,
  sendMessage: mockSendMessage,
  clearMessages: mockClearMessages,
  mode: "claude-cli" as import("../agent/useAgent").AgentMode,
};

vi.mock("../agent/useAgent", () => ({
  useAgent: () => agentState,
}));

const defaultProps = { libraryPath: "/fake/master.db", onClose: vi.fn() };

beforeEach(() => {
  agentState = {
    messages: [],
    isStreaming: false,
    error: null,
    sendMessage: mockSendMessage,
    clearMessages: mockClearMessages,
    mode: "claude-cli" as import("../agent/useAgent").AgentMode,
  };
  vi.clearAllMocks();
});

describe("ChatPanel", () => {
  it("renders placeholder when no messages", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText("Ask about your library…")).toBeTruthy();
  });

  it("renders header title", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText("Agent")).toBeTruthy();
  });

  it("send button disabled when input is empty", () => {
    render(<ChatPanel {...defaultProps} />);
    const btn = screen.getByLabelText("Send message");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("send button enabled when input has text", async () => {
    render(<ChatPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Message…");
    fireEvent.change(textarea, { target: { value: "hello" } });
    const btn = screen.getByLabelText("Send message");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls sendMessage on button click and clears input", () => {
    render(<ChatPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Message…");
    fireEvent.change(textarea, { target: { value: "find jazz tracks" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(mockSendMessage).toHaveBeenCalledWith("find jazz tracks");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("calls sendMessage on Enter key", () => {
    render(<ChatPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Message…");
    fireEvent.change(textarea, { target: { value: "list playlists" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockSendMessage).toHaveBeenCalledWith("list playlists");
  });

  it("does not send on Shift+Enter", () => {
    render(<ChatPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Message…");
    fireEvent.change(textarea, { target: { value: "hi" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<ChatPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close agent panel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders user messages as right-aligned bubbles", () => {
    agentState.messages = [{ role: "user", text: "Search for techno" }];
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText("Search for techno")).toBeTruthy();
  });

  it("renders assistant text blocks", () => {
    agentState.messages = [
      {
        role: "assistant",
        blocks: [{ type: "text", text: "Here are the results." }],
      },
    ];
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText("Here are the results.")).toBeTruthy();
  });

  it("renders tool call cards", () => {
    agentState.messages = [
      {
        role: "assistant",
        blocks: [
          {
            type: "tool_call",
            id: "tc_1",
            name: "library__search",
            input: { query: "techno" },
          },
        ],
      },
    ];
    render(<ChatPanel {...defaultProps} />);
    // Label: "library › search"
    expect(screen.getByText("library › search")).toBeTruthy();
  });

  it("hides tool_results messages", () => {
    agentState.messages = [
      {
        role: "tool_results",
        results: [
          { type: "tool_result", tool_use_id: "tc_1", content: '{"tracks":[]}' },
        ],
      },
    ];
    render(<ChatPanel {...defaultProps} />);
    // tool_result content must not appear in the DOM
    expect(screen.queryByText('{"tracks":[]}')).toBeNull();
  });

  it("shows error message", () => {
    agentState.error = "No API key set";
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByText("No API key set")).toBeTruthy();
  });

  it("shows clear button when messages exist", () => {
    agentState.messages = [{ role: "user", text: "hi" }];
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByLabelText("Clear chat")).toBeTruthy();
  });

  it("calls clearMessages when clear button clicked", () => {
    agentState.messages = [{ role: "user", text: "hi" }];
    render(<ChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Clear chat"));
    expect(mockClearMessages).toHaveBeenCalled();
  });

  it("shows spinner in send button while streaming", () => {
    agentState.isStreaming = true;
    render(<ChatPanel {...defaultProps} />);
    const btn = screen.getByLabelText("Send message");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Spinner div present inside button
    expect(btn.querySelector(".animate-spin")).toBeTruthy();
  });
});
