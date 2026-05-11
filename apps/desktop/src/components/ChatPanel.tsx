import { useRef, useEffect, useState, useCallback } from "react";
import { useAgent } from "../agent/useAgent";
import type { AssistantMessage, ToolResultBlock } from "../agent/types";

interface Props {
  libraryPath: string;
  onClose: () => void;
}

function ToolCallCard({
  name,
  input,
}: {
  name: string;
  input: Record<string, unknown>;
}) {
  const label = name.replace(/__/g, " › ").replace(/_/g, " ");
  const params = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  return (
    <div className="my-1 flex items-start gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400">
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="mt-px h-3 w-3 shrink-0 text-indigo-400"
      >
        <path d="M5.433.755a.75.75 0 01.832.27l1.5 2a.75.75 0 01-.164.999L6 5.017l.002.017a7.496 7.496 0 003.96 3.961l.017.002 1.993-1.601a.75.75 0 01.999-.164l2 1.5a.75.75 0 01.27.832l-.75 2.5a.75.75 0 01-.72.536A13.998 13.998 0 010 .75a.75.75 0 01.536-.72l2.5-.75z" />
      </svg>
      <span className="font-medium text-zinc-300">{label}</span>
      {params && <span className="ml-1 truncate text-zinc-500">{params}</span>}
    </div>
  );
}

function AssistantBubble({ msg }: { msg: AssistantMessage }) {
  const hasContent = msg.blocks.some(
    (b) => b.type === "text" && b.text.length > 0,
  );
  const hasToolCalls = msg.blocks.some((b) => b.type === "tool_call");

  return (
    <div className="max-w-[90%]">
      {msg.blocks.map((block, i) => {
        if (block.type === "text" && block.text) {
          return (
            <p
              key={i}
              className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200"
            >
              {block.text}
            </p>
          );
        }
        if (block.type === "tool_call") {
          return (
            <ToolCallCard key={block.id} name={block.name} input={block.input} />
          );
        }
        return null;
      })}
      {!hasContent && !hasToolCalls && (
        <div className="h-4 w-4 animate-spin rounded-full border border-zinc-700 border-t-indigo-400" />
      )}
    </div>
  );
}

function ToolResultSummary({ result }: { result: ToolResultBlock }) {
  let payload: unknown;
  try {
    payload = JSON.parse(result.content);
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null || !("tool" in payload)) {
    return null;
  }

  const tool = String((payload as { tool: unknown }).tool);
  let title = tool;
  let detail = "";

  if (tool === "library.search") {
    const tracks = (payload as { tracks?: unknown[] }).tracks ?? [];
    title = "Search results";
    detail = `${tracks.length} tracks`;
  } else if (tool === "library.list_playlists") {
    const playlists = (payload as { playlists?: unknown[] }).playlists ?? [];
    title = "Playlists";
    detail = `${playlists.length} playlists`;
  } else if (tool === "library.get_playlist") {
    const p = payload as {
      detail?: { playlist?: { name?: string }; tracks?: unknown[] } | null;
    };
    title = p.detail?.playlist?.name ?? "Playlist";
    detail = `${p.detail?.tracks?.length ?? 0} tracks`;
  } else if (tool === "library.get_track") {
    const p = payload as { track?: { title?: string } | null };
    title = p.track?.title ?? "Track not found";
  } else if (tool === "library.list_cues") {
    const cues = (payload as { cues?: unknown[] }).cues ?? [];
    title = "Cues";
    detail = `${cues.length} cues`;
  } else if (tool === "health.orphan_scan") {
    const orphans = (payload as { orphans?: unknown[] }).orphans ?? [];
    title = "Missing files";
    detail = `${orphans.length} tracks`;
  } else if (tool === "health.duplicate_scan") {
    const groups = (payload as { groups?: unknown[] }).groups ?? [];
    title = "Duplicate candidates";
    detail = `${groups.length} groups`;
  } else if (tool === "health.broken_link_scan") {
    const report = payload as {
      report?: {
        missing_artist?: unknown[];
        missing_bpm?: unknown[];
        missing_key?: unknown[];
        missing_genre?: unknown[];
        suspicious?: unknown[];
      };
    };
    const count =
      (report.report?.missing_artist?.length ?? 0) +
      (report.report?.missing_bpm?.length ?? 0) +
      (report.report?.missing_key?.length ?? 0) +
      (report.report?.missing_genre?.length ?? 0) +
      (report.report?.suspicious?.length ?? 0);
    title = "Metadata issues";
    detail = `${count} issues`;
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
      <div className="font-medium text-zinc-200">{title}</div>
      {detail && <div className="mt-0.5 text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

export function ChatPanel({ libraryPath, onClose }: Props) {
  const {
    messages,
    conversations,
    activeConversationId,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    newConversation,
    loadConversation,
    deleteActiveConversation,
  } = useAgent(libraryPath);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-100">Agent</span>
          {conversations.length > 0 && (
            <select
              aria-label="Conversation"
              value={activeConversationId ?? ""}
              onChange={(event) => void loadConversation(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Select conversation
              </option>
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="ml-2 flex items-center gap-1">
          <button
            onClick={newConversation}
            aria-label="New conversation"
            title="New conversation"
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M8 1.75a.75.75 0 01.75.75v4.75h4.75a.75.75 0 010 1.5H8.75v4.75a.75.75 0 01-1.5 0V8.75H2.5a.75.75 0 010-1.5h4.75V2.5A.75.75 0 018 1.75z" />
            </svg>
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              aria-label="Clear chat"
              title="Clear conversation"
              className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M2.5 1a1 1 0 00-1 1v1a1 1 0 001 1H3v9a2 2 0 002 2h6a2 2 0 002-2V4h.5a1 1 0 001-1V2a1 1 0 00-1-1H10a1 1 0 00-1-1H7a1 1 0 00-1 1H2.5zm3 4a.5.5 0 011 0v7a.5.5 0 01-1 0V5zm3 0a.5.5 0 011 0v7a.5.5 0 01-1 0V5z" />
              </svg>
            </button>
          )}
          {activeConversationId && (
            <button
              onClick={() => void deleteActiveConversation()}
              aria-label="Delete conversation"
              title="Delete conversation"
              className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.5 1h3a1 1 0 011 1v1h3a.75.75 0 010 1.5h-.5v8A2.5 2.5 0 0110.5 15h-5A2.5 2.5 0 013 12.5v-8h-.5a.75.75 0 010-1.5h3V2a1 1 0 011-1zm1 2h1V2.5h-1V3zm-3 1.5v8A1 1 0 005.5 13.5h5a1 1 0 001-1v-8h-7z" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close agent panel"
            className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !error && (
          <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">
            Ask about your library…
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white">
                  {msg.text}
                </div>
              </div>
            );
          }
          if (msg.role === "assistant") {
            return (
              <div key={i} className="flex justify-start">
                <AssistantBubble msg={msg} />
              </div>
            );
          }
          return (
            <div key={i} className="flex flex-col gap-2">
              {msg.results.map((result) => (
                <ToolResultSummary
                  key={result.tool_use_id}
                  result={result}
                />
              ))}
            </div>
          );
        })}

        {error && (
          <div className="rounded-md bg-red-950/60 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || input.trim() === ""}
            aria-label="Send message"
            className="shrink-0 rounded-md bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStreaming ? (
              <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white" />
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M15.964.686a.5.5 0 00-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 00-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 00.886-.083l6-15z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
