import { useEffect, useState, useCallback, useRef } from "react";
import { useAgent } from "../agent/useAgent";
import type { AssistantMessage, ToolResultBlock } from "../agent/types";
import { Message, MessageContent } from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/conversation";

interface Props {
  libraryPath: string;
  onClose: () => void;
  /** When set, the panel will auto-send this prompt and call onPromptConsumed.
   *  Used by the Audit view to start a scan from outside the chat. */
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
}

// ─── Suggestion presets (deck-style hardware buttons) ──────────────────────
const AUDIT_PROMPT =
  "Audit missing or bad metadata and playlist issues. Use the available health and playlist tools, summarize the issues, and stage only safe proposed fixes for review. Do not claim anything was applied directly.";

const SUGGESTIONS: { label: string; hint: string; prompt: string }[] = [
  {
    label: "Find duplicate tracks",
    hint: "health · duplicate scan",
    prompt:
      "Run a duplicate scan on my library and group results by likely duplicates. Don't stage anything yet — just summarize what you find.",
  },
  {
    label: "Tracks missing metadata",
    hint: "health · broken links",
    prompt:
      "Show me which tracks are missing BPM, key, genre, or artist. Group by issue type and give me counts.",
  },
  {
    label: "List my playlists",
    hint: "library · playlists",
    prompt: "List my playlists, grouped by folder if any, with track counts.",
  },
];

// ─── Tool-call telemetry row ───────────────────────────────────────────────
function ToolCallCard({
  name,
  input,
}: {
  name: string;
  input: Record<string, unknown>;
}) {
  // Preserve test contract: `library__search` → `library › search`
  const label = name.replace(/__/g, " › ").replace(/_/g, " ");
  const params = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("  ");

  return (
    <div className="my-1 flex items-center gap-2.5 border-l border-accent/60 bg-accent/[0.04] py-1 pl-2.5 pr-2 text-[11px]">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
        style={{ animation: "telemetryBlink 1.1s ease-in-out infinite" }}
      />
      <span className="font-deck font-medium uppercase tracking-[0.08em] text-accent-hover">
        {label}
      </span>
      {params && (
        <span className="font-deck min-w-0 truncate text-ink-muted">
          {params}
        </span>
      )}
    </div>
  );
}

function AssistantBubble({
  msg,
  isStreaming,
  isLast,
}: {
  msg: AssistantMessage;
  isStreaming: boolean;
  isLast: boolean;
}) {
  const hasContent = msg.blocks.some(
    (b) => b.type === "text" && b.text.length > 0,
  );
  const hasToolCalls = msg.blocks.some((b) => b.type === "tool_call");
  const showShimmer = isStreaming && isLast && !hasContent && !hasToolCalls;

  return (
    <div className="flex flex-col gap-1.5">
      {msg.blocks.map((block, i) => {
        if (block.type === "text" && block.text) {
          return (
            <Response
              key={i}
              className="text-[13px] leading-[1.55] text-ink"
            >
              {block.text}
            </Response>
          );
        }
        if (block.type === "tool_call") {
          return (
            <ToolCallCard key={block.id} name={block.name} input={block.input} />
          );
        }
        return null;
      })}
      {showShimmer && (
        <div className="flex items-center gap-2 pt-0.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animation: "cuePulse 1.6s ease-in-out infinite" }}
          />
          <ShimmeringText
            text="thinking"
            className="font-deck text-[10.5px] uppercase tracking-[0.18em] text-ink-secondary"
            spread={1}
          />
        </div>
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
  } else if (tool === "staging.stage_change") {
    const change = (payload as {
      change?: { kind?: string; field?: string | null; status?: string };
    }).change;
    title = "Change proposed";
    detail = [change?.kind, change?.field, change?.status]
      .filter(Boolean)
      .join(" · ");
  } else if (tool === "staging.list_changes") {
    const changes = (payload as { changes?: unknown[] }).changes ?? [];
    title = "Staged changes";
    detail = `${changes.length} changes`;
  }

  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-edge/60 py-1.5">
      <span className="text-[12px] text-ink">{title}</span>
      {detail && (
        <span className="font-deck text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
          {detail}
        </span>
      )}
    </div>
  );
}

// ─── Header icon button (consistent hardware look) ─────────────────────────
function HeaderIconButton({
  onClick,
  ariaLabel,
  title,
  children,
  variant = "default",
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const hover =
    variant === "danger"
      ? "hover:text-status-error hover:border-status-error/40"
      : "hover:text-accent-hover hover:border-accent/40";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={`flex h-6 w-6 items-center justify-center rounded-sm border border-edge/50 text-ink-muted transition-colors ${hover}`}
    >
      {children}
    </button>
  );
}

export function ChatPanel({
  libraryPath,
  onClose,
  pendingPrompt,
  onPromptConsumed,
}: Props) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!pendingPrompt) return;
    if (isStreaming) return;
    void sendMessage(pendingPrompt);
    onPromptConsumed?.();
  }, [pendingPrompt, isStreaming, sendMessage, onPromptConsumed]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleAudit = useCallback(() => {
    if (isStreaming) return;
    void sendMessage(AUDIT_PROMPT);
  }, [isStreaming, sendMessage]);

  const handleSuggestion = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      void sendMessage(prompt);
    },
    [isStreaming, sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = input.length;

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-edge bg-base animate-[slideInRight_180ms_ease-out]">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-edge">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-accent"
              style={{
                animation: isStreaming
                  ? "cuePulse 1.4s ease-in-out infinite"
                  : undefined,
                boxShadow: isStreaming
                  ? undefined
                  : "0 0 6px rgb(var(--accent) / 0.5)",
              }}
            />
            <span className="font-deck text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink">
              Agent
            </span>
          </div>
          <div className="flex items-center gap-1">
            <HeaderIconButton
              onClick={newConversation}
              ariaLabel="New conversation"
              title="Start a new conversation"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3 w-3">
                <path d="M8 1.75a.75.75 0 01.75.75v4.75h4.75a.75.75 0 010 1.5H8.75v4.75a.75.75 0 01-1.5 0V8.75H2.5a.75.75 0 010-1.5h4.75V2.5A.75.75 0 018 1.75z" />
              </svg>
            </HeaderIconButton>
            {messages.length > 0 && !activeConversationId && (
              <HeaderIconButton
                onClick={clearMessages}
                ariaLabel="Clear chat"
                title="Clear unsaved messages"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-3 w-3">
                  <path d="M9 2L2 9l5 5h7l-1.5-1.5" />
                  <path d="M6 6l5 5" />
                </svg>
              </HeaderIconButton>
            )}
            {activeConversationId && (
              <HeaderIconButton
                onClick={() => void deleteActiveConversation()}
                ariaLabel="Delete conversation"
                title="Delete this conversation permanently"
                variant="danger"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3 w-3">
                  <path d="M6.5 1h3a1 1 0 011 1v1h3a.75.75 0 010 1.5h-.5v8A2.5 2.5 0 0110.5 15h-5A2.5 2.5 0 013 12.5v-8h-.5a.75.75 0 010-1.5h3V2a1 1 0 011-1zm1 2h1V2.5h-1V3zm-3 1.5v8A1 1 0 005.5 13.5h5a1 1 0 001-1v-8h-7z" />
                </svg>
              </HeaderIconButton>
            )}
            <HeaderIconButton onClick={onClose} ariaLabel="Close agent panel">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3 w-3">
                <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </HeaderIconButton>
          </div>
        </div>

        {/* Conversation switcher — its own row, only when there's something to switch to */}
        {conversations.length > 0 && (
          <div className="relative px-4 pb-2">
            <select
              aria-label="Conversation"
              value={activeConversationId ?? ""}
              onChange={(event) => void loadConversation(event.target.value)}
              className="w-full cursor-pointer appearance-none rounded-sm border border-edge bg-transparent py-1 pl-2 pr-7 text-[12px] text-ink-secondary transition-colors hover:border-accent/40 focus:border-accent focus:text-ink focus:outline-none"
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
            <svg
              aria-hidden
              viewBox="0 0 10 6"
              className="pointer-events-none absolute right-6 top-1/2 h-1.5 w-2.5 -translate-y-1/2 text-ink-muted"
            >
              <path d="M0 0l5 6 5-6" fill="currentColor" />
            </svg>
          </div>
        )}
      </header>

      {/* ─── Messages OR Empty state ────────────────────────────── */}
      {messages.length === 0 && !error ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          {/* Hero motif — chamfered amber lozenge */}
          <div
            className="clip-chamfer mb-5 flex h-14 w-14 items-center justify-center bg-accent-dim/30"
            style={{ boxShadow: "inset 0 0 0 1px rgb(var(--accent) / 0.35)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-accent-hover">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5L20 7v10l-8 4.5L4 17V7l8-4.5z" />
              <circle cx="12" cy="12" r="2.25" fill="currentColor" />
            </svg>
          </div>

          <p className="font-deck text-[10.5px] font-semibold uppercase tracking-[0.28em] text-accent-hover">
            Agent Assistant
          </p>
          <p className="mt-3 max-w-[260px] text-center text-[12.5px] leading-[1.55] text-ink-secondary">
            Ask about your library, find duplicate tracks, or stage metadata
            fixes for review.
          </p>

          {/* Pipeline rail */}
          <div className="mt-4 flex items-center gap-2 font-deck text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
            <span>Scan</span>
            <span className="h-px w-3 bg-edge-strong" />
            <span>Propose</span>
            <span className="h-px w-3 bg-edge-strong" />
            <span>Review</span>
            <span className="h-px w-3 bg-edge-strong" />
            <span>Export</span>
          </div>

          {/* Primary CTA — chamfered amber deck button */}
          <button
            onClick={handleAudit}
            disabled={isStreaming}
            className="clip-chamfer group mt-7 flex items-center gap-2.5 bg-accent-strong px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: "0 0 0 1px rgb(var(--accent) / 0.4), 0 0 18px -4px rgb(var(--accent) / 0.55)" }}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3 w-3">
              <path d="M3 2l11 6-11 6V2z" />
            </svg>
            <span>Start Library Audit</span>
          </button>

          {/* Suggestion chips */}
          <div className="mt-6 w-full max-w-[280px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-edge" />
              <span className="font-deck text-[9.5px] uppercase tracking-[0.22em] text-ink-faint">
                or try
              </span>
              <span className="h-px flex-1 bg-edge" />
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSuggestion(s.prompt)}
                  className="group flex items-center justify-between gap-2 rounded-sm border border-edge bg-surface/50 px-3 py-1.5 text-left transition-colors hover:border-accent/50 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    opacity: 0,
                    animation: `chipIn 280ms ease-out ${180 + i * 70}ms forwards`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-ink group-hover:text-ink">
                      {s.label}
                    </div>
                    <div className="font-deck mt-0.5 text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
                      {s.hint}
                    </div>
                  </div>
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="h-2.5 w-2.5 shrink-0 text-ink-faint transition-colors group-hover:text-accent-hover">
                    <path d="M2 5h6m-2-3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Conversation className="flex-1">
          <ConversationContent className="flex flex-col gap-2 px-4 py-3">
            {messages.map((msg, i) => {
              const isLastAssistant =
                msg.role === "assistant" && i === messages.length - 1;
              if (msg.role === "user") {
                return (
                  <Message key={i} from="user">
                    <MessageContent
                      variant="contained"
                      className="text-[13px] leading-[1.5]"
                    >
                      {msg.text}
                    </MessageContent>
                  </Message>
                );
              }
              if (msg.role === "assistant") {
                return (
                  <Message key={i} from="assistant">
                    <MessageContent
                      variant="flat"
                      className="w-full max-w-full px-0"
                    >
                      <AssistantBubble
                        msg={msg}
                        isStreaming={isStreaming}
                        isLast={isLastAssistant}
                      />
                    </MessageContent>
                  </Message>
                );
              }
              return (
                <div key={i} className="flex flex-col">
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
              <div className="flex items-start gap-2 border-l-2 border-status-error bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="mt-0.5 h-3 w-3 shrink-0">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 011 1v4a1 1 0 11-2 0V5a1 1 0 011-1zm0 8a1 1 0 110 2 1 1 0 010-2z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {/* ─── Composer ───────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-edge bg-base/50 px-4 pt-3 pb-2">
        <div
          className="group relative flex items-end gap-2 rounded-md border border-edge-strong bg-surface px-3 py-2 transition-colors focus-within:border-accent/60"
          style={{
            boxShadow: "inset 0 1px 0 rgb(var(--text-primary) / 0.03)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent…"
            rows={1}
            className="min-h-[20px] flex-1 resize-none bg-transparent text-[13px] leading-[1.45] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || input.trim() === ""}
            aria-label="Send message"
            className="clip-chamfer relative flex h-7 w-7 shrink-0 items-center justify-center bg-accent-strong text-white transition-all hover:bg-accent disabled:cursor-not-allowed disabled:bg-edge-strong disabled:text-ink-faint"
            style={
              !isStreaming && input.trim() !== ""
                ? {
                    boxShadow:
                      "0 0 0 1px rgb(var(--accent) / 0.4), 0 0 12px -2px rgb(var(--accent) / 0.55)",
                  }
                : undefined
            }
          >
            {isStreaming ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="h-3 w-3 translate-x-px">
                <path d="M3 2l11 6-11 6V2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Composer status bar */}
        <div className="mt-1.5 flex items-center justify-between px-1 text-ink-faint">
          <span className="font-deck text-[9.5px] uppercase tracking-[0.18em]">
            {isStreaming ? (
              <span className="text-accent-hover">streaming…</span>
            ) : (
              <>
                <kbd className="font-deck text-[9.5px]">⏎</kbd> send ·{" "}
                <kbd className="font-deck text-[9.5px]">⇧⏎</kbd> newline
              </>
            )}
          </span>
          {charCount > 0 && (
            <span className="font-deck text-[9.5px] uppercase tracking-[0.14em] tabular-nums">
              {charCount} ch
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
