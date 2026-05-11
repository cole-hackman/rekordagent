import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey, claudeAvailable, chatWithClaude } from "../ipc";
import { TOOL_SCHEMAS, executeTool } from "./tools";
import type {
  ChatMessage,
  AssistantMessage,
  ContentBlock,
  ToolResultBlock,
} from "./types";

const MODEL = "claude-opus-4-5";

const SYSTEM = `You are a DJ assistant with access to the user's Rekordbox library. \
Help them search their collection, inspect playlists, and audit their library. \
When using tools, be concise in the surrounding text — let the results speak for themselves.`;

// ── Anthropic API message format ──────────────────────────────────────────────

type ApiMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | { type: "tool_result"; tool_use_id: string; content: string }
      >;
};

// ── Streamed chunk payload from the Rust claude_agent ─────────────────────────

interface ClaudeChunk {
  text: string;
  sessionId: string | null;
  done: boolean;
  error: string | null;
}

export type AgentMode = "claude-cli" | "api-key" | "no-auth";

export function useAgent(libraryPath: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>("no-auth");

  // Session ID for claude-cli conversation continuity.
  const sessionIdRef = useRef<string | null>(null);

  // Detect which auth mode to use on mount.
  useEffect(() => {
    (async () => {
      const available = await claudeAvailable().catch(() => false);
      if (available) {
        setMode("claude-cli");
        return;
      }
      const key = await getApiKey("anthropic_api_key").catch(() => null);
      setMode(key ? "api-key" : "no-auth");
    })();
  }, []);

  // ── claude-cli send ──────────────────────────────────────────────────────────

  const sendViaClaude = useCallback(
    async (text: string) => {
      setIsStreaming(true);

      const assistantMsg: AssistantMessage = { role: "assistant", blocks: [] };
      setMessages((prev) => [...prev, assistantMsg]);

      // Unique event name so concurrent requests never bleed.
      const eventName = `claude-chunk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const unlisten = await listen<ClaudeChunk>(eventName, (event) => {
        const { text: chunk, sessionId, done, error: chunkError } = event.payload;

        if (done) {
          if (sessionId) sessionIdRef.current = sessionId;
          if (chunkError) setError(chunkError);
          setIsStreaming(false);
          return;
        }

        if (chunk) {
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last?.role !== "assistant") return prev;
            const blocks = [...last.blocks];
            const tail = blocks[blocks.length - 1];
            if (tail?.type === "text") {
              blocks[blocks.length - 1] = { ...tail, text: tail.text + chunk };
            } else {
              blocks.push({ type: "text", text: chunk });
            }
            return [...msgs.slice(0, -1), { ...last, blocks }];
          });
        }
      });

      try {
        const newSessionId = await chatWithClaude(
          text,
          sessionIdRef.current,
          eventName,
        );
        if (newSessionId) sessionIdRef.current = newSessionId;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.blocks.length === 0) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        unlisten();
        setIsStreaming(false);
      }
    },
    [],
  );

  // ── API-key send (existing agentic loop) ─────────────────────────────────────

  const buildApiHistory = (msgs: ChatMessage[]): ApiMessage[] => {
    const result: ApiMessage[] = [];
    for (const m of msgs) {
      if (m.role === "user") {
        result.push({ role: "user", content: m.text });
      } else if (m.role === "assistant") {
        const content = m.blocks
          .filter((b) => b.type === "text" || b.type === "tool_call")
          .map((b) => {
            if (b.type === "text") return { type: "text" as const, text: b.text };
            return {
              type: "tool_use" as const,
              id: b.id,
              name: b.name,
              input: b.input,
            };
          });
        result.push({ role: "assistant", content });
      } else if (m.role === "tool_results") {
        result.push({
          role: "user",
          content: m.results.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
          })),
        });
      }
    }
    return result;
  };

  const sendViaApiKey = useCallback(
    async (_text: string, currentMessages: ChatMessage[]) => {
      const apiKey = await getApiKey("anthropic_api_key").catch(() => null);
      if (!apiKey) {
        setError("No Anthropic API key set. Add one in Settings (⚙) to use the agent.");
        return;
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      setIsStreaming(true);
      try {
        let msgs = currentMessages;

        while (true) {
          const assistantMsg: AssistantMessage = { role: "assistant", blocks: [] };
          setMessages((prev) => [...prev, assistantMsg]);

          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM,
            tools: TOOL_SCHEMAS,
            messages: buildApiHistory(msgs),
          });

          const toolInputAccum: Record<number, string> = {};

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const chunk = event.delta.text;
              setMessages((prev) => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last.role !== "assistant") return prev;
                const blocks = [...last.blocks];
                const tail = blocks[blocks.length - 1];
                if (tail?.type === "text") {
                  blocks[blocks.length - 1] = { ...tail, text: tail.text + chunk };
                } else {
                  blocks.push({ type: "text", text: chunk });
                }
                return [...list.slice(0, -1), { ...last, blocks }];
              });
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              const { id, name } = event.content_block;
              toolInputAccum[event.index] = "";
              const block: ContentBlock = { type: "tool_call", id, name, input: {} };
              setMessages((prev) => {
                const list = [...prev];
                const last = list[list.length - 1];
                if (last.role !== "assistant") return prev;
                return [...list.slice(0, -1), { ...last, blocks: [...last.blocks, block] }];
              });
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "input_json_delta"
            ) {
              toolInputAccum[event.index] =
                (toolInputAccum[event.index] ?? "") + event.delta.partial_json;
            }
          }

          const finalMsg = await stream.finalMessage();
          const toolCallBlocks = finalMsg.content.filter(
            (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          setMessages((prev) => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last.role !== "assistant") return prev;
            const blocks = last.blocks.map((b) => {
              if (b.type !== "tool_call") return b;
              const apiBlock = toolCallBlocks.find(
                (t: Anthropic.ToolUseBlock) => t.id === b.id,
              );
              return { ...b, input: (apiBlock?.input as Record<string, unknown>) ?? {} };
            });
            return [...list.slice(0, -1), { ...last, blocks }];
          });

          msgs = [...msgs, assistantMsg];

          if (finalMsg.stop_reason !== "tool_use") break;

          const results: ToolResultBlock[] = [];
          for (const toolBlock of toolCallBlocks) {
            try {
              const payload = await executeTool(
                toolBlock.name,
                toolBlock.input as Record<string, unknown>,
                libraryPath!,
              );
              results.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: JSON.stringify(payload),
              });
            } catch (e) {
              results.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: JSON.stringify({ error: String(e) }),
              });
            }
          }

          const toolResultMsg: ChatMessage = { role: "tool_results", results };
          setMessages((prev) => [...prev, toolResultMsg]);
          msgs = [...msgs, toolResultMsg];
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.blocks.length === 0) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [libraryPath],
  );

  // ── Public sendMessage ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!libraryPath || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = { role: "user", text };
      setMessages((prev) => [...prev, userMsg]);

      if (mode === "claude-cli") {
        await sendViaClaude(text);
      } else if (mode === "api-key") {
        await sendViaApiKey(text, [...messages, userMsg]);
      } else {
        setError(
          "No Claude subscription found and no API key is set. " +
            "Install the claude CLI (claude.ai/code) or add an API key in Settings (⚙).",
        );
      }
    },
    [libraryPath, isStreaming, mode, messages, sendViaClaude, sendViaApiKey],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionIdRef.current = null;
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages, mode };
}
