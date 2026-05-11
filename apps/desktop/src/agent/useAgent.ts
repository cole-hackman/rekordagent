import { useState, useCallback, useEffect } from "react";
import Anthropic from "@anthropic-ai/sdk";
import {
  getApiKey,
  getClaudeCodeStatus,
  listConversations,
  createConversation,
  loadConversation as loadConversationIpc,
  appendConversationMessage,
  deleteConversation,
} from "../ipc";
import { TOOL_SCHEMAS, executeTool } from "./tools";
import type {
  ChatMessage,
  AssistantMessage,
  ContentBlock,
  ToolResultBlock,
  ConversationSummary,
} from "./types";

const MODEL = "claude-opus-4-5";

const SYSTEM = `You are a DJ assistant with access to the user's Rekordbox library. \
Help them search their collection, inspect playlists, and audit their library. \
When using tools, be concise in the surrounding text — let the results speak for themselves.`;

// Anthropic API message format
type ApiMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | {
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }
      >;
};

export function useAgent(libraryPath: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!libraryPath) return;
    const list = await listConversations(libraryPath).catch(() => []);
    setConversations(list);
  }, [libraryPath]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const ensureConversation = useCallback(
    async (firstText: string) => {
      if (activeConversationId) return activeConversationId;
      const title = firstText.trim().slice(0, 48) || "New conversation";
      const conversation = await createConversation(libraryPath, title);
      setActiveConversationId(conversation.id);
      setConversations((prev) => [conversation, ...prev]);
      return conversation.id;
    },
    [activeConversationId, libraryPath],
  );

  const persistMessage = useCallback(
    async (conversationId: string | null, message: ChatMessage) => {
      if (!conversationId) return;
      await appendConversationMessage(conversationId, message.role, message).catch(() => {});
      void refreshConversations();
    },
    [refreshConversations],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!libraryPath || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = { role: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      const conversationId = await ensureConversation(text).catch(() => null);
      await persistMessage(conversationId, userMsg);

      const apiKey = await getApiKey("anthropic_api_key").catch(() => null);
      if (!apiKey) {
        const claudeCode = await getClaudeCodeStatus().catch(() => null);
        if (claudeCode?.installed && claudeCode.logged_in) {
          setError(
            "Claude Code is installed and signed in, but this chat runtime currently uses Anthropic API keys. Add an API key in Settings while Claude Code runtime support is being wired in.",
          );
        } else {
          setError(
            "No Anthropic API key set. Add one in Settings (⚙) to use the agent.",
          );
        }
        return;
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      // Build API conversation history from chat messages
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

      setIsStreaming(true);
      try {
        // agentic loop: keep calling until stop_reason !== "tool_use"
        let currentMessages = [...messages, userMsg];

        while (true) {
          const assistantMsg: AssistantMessage = {
            role: "assistant",
            blocks: [],
          };
          setMessages((prev) => [...prev, assistantMsg]);

          const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM,
            tools: TOOL_SCHEMAS,
            messages: buildApiHistory(currentMessages),
          });

          // Track accumulation per content block index
          const toolInputAccum: Record<number, string> = {};

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "text"
            ) {
              // text block started — nothing to do yet
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = event.delta.text;
              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last.role !== "assistant") return prev;
                const blocks = [...last.blocks];
                const lastBlock = blocks[blocks.length - 1];
                if (lastBlock?.type === "text") {
                  blocks[blocks.length - 1] = {
                    ...lastBlock,
                    text: lastBlock.text + chunk,
                  };
                } else {
                  blocks.push({ type: "text", text: chunk });
                }
                return [...msgs.slice(0, -1), { ...last, blocks }];
              });
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              const { id, name } = event.content_block;
              toolInputAccum[event.index] = "";
              const block: ContentBlock = {
                type: "tool_call",
                id,
                name,
                input: {},
              };
              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last.role !== "assistant") return prev;
                return [
                  ...msgs.slice(0, -1),
                  { ...last, blocks: [...last.blocks, block] },
                ];
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
            (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock =>
              b.type === "tool_use",
          );
          const assistantBlocks: ContentBlock[] = [];
          for (const block of finalMsg.content) {
            if (block.type === "text" && block.text) {
              assistantBlocks.push({ type: "text", text: block.text });
            } else if (block.type === "tool_use") {
              assistantBlocks.push({
                type: "tool_call",
                id: block.id,
                name: block.name,
                input: (block.input as Record<string, unknown>) ?? {},
              });
            }
          }
          const finalAssistantMsg: AssistantMessage = {
            role: "assistant",
            blocks: assistantBlocks,
          };

          // Finalize assistant message in state with parsed inputs
          setMessages((prev) => {
            const msgs = [...prev];
            const last = msgs[msgs.length - 1];
            if (last.role !== "assistant") return prev;
            return [...msgs.slice(0, -1), finalAssistantMsg];
          });
          await persistMessage(conversationId, finalAssistantMsg);

          currentMessages = [...currentMessages, finalAssistantMsg];

          if (finalMsg.stop_reason !== "tool_use") break;

          // Execute tools and collect results
          const results: ToolResultBlock[] = [];
          for (const toolBlock of toolCallBlocks) {
            try {
              const payload = await executeTool(
                toolBlock.name,
                toolBlock.input as Record<string, unknown>,
                libraryPath,
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

          const toolResultMsg: ChatMessage = {
            role: "tool_results",
            results,
          };
          setMessages((prev) => [...prev, toolResultMsg]);
          await persistMessage(conversationId, toolResultMsg);
          currentMessages = [...currentMessages, toolResultMsg];
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "assistant" &&
            last.blocks.length === 0
          ) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [libraryPath, isStreaming, messages, ensureConversation, persistMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const loaded = await loadConversationIpc(id);
    if (!loaded) return;
    setActiveConversationId(id);
    setMessages(loaded.messages.map((message) => message.content));
    setError(null);
  }, []);

  const deleteActiveConversation = useCallback(async () => {
    if (!activeConversationId) {
      newConversation();
      return;
    }
    await deleteConversation(activeConversationId);
    newConversation();
    await refreshConversations();
  }, [activeConversationId, newConversation, refreshConversations]);

  return {
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
  };
}
