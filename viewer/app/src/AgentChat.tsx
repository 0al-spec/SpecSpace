import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from "@assistant-ui/react";
import "./AgentChat.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faChevronDown, faPaperPlane, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

// ── Abstract adapter ─────────────────────────────────────────────────────────
// Swap this implementation for a real /api/agent endpoint later.
// The signature is fixed: run() yields cumulative ChatModelRunResult updates.

async function* mockStream(
  options: ChatModelRunOptions
): AsyncGenerator<ChatModelRunResult> {
  const { messages, abortSignal } = options;

  // Build a simple context-aware mock reply
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText =
    lastUser?.content
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ") ?? "";

  const reply = generateMockReply(userText);
  const words = reply.split(" ");

  let accumulated = "";
  for (const word of words) {
    if (abortSignal.aborted) break;
    await sleep(55 + Math.random() * 45);
    accumulated += (accumulated ? " " : "") + word;
    yield { content: [{ type: "text", text: accumulated }] };
  }
}

const abstractAdapter: ChatModelAdapter = {
  run: (options) => mockStream(options),
};

function generateMockReply(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("spec") || lower.includes("node"))
    return "I can help you refine or create spec nodes. What aspect of the specification would you like to work on — acceptance criteria, edge relationships, or the specification body itself?";
  if (lower.includes("gap") || lower.includes("evidence"))
    return "Gaps represent unresolved areas in the spec graph: missing evidence for acceptance criteria, raw-file inputs that haven't been formalized as spec nodes, or specs that have never been executed. Which gap would you like to address?";
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey"))
    return "Hello! I'm your SpecGraph agent. I can help you write, refine, or reason about specification nodes. Select a node on the graph to give me context, then ask away.";
  return "Got it. To make progress on this, I'd want to understand the intent behind it first — what outcome should this spec govern, and what would make it verifiably complete?";
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgentChatProps {
  open: boolean;
  onClose: () => void;
  contextNodeId?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentChat({ open, onClose, contextNodeId }: AgentChatProps) {
  const runtime = useLocalRuntime(abstractAdapter, {
    initialMessages: contextNodeId
      ? [
          {
            role: "assistant" as const,
            content: [
              {
                type: "text" as const,
                text: `Context: spec node **${contextNodeId}** is selected. Ask me anything about it, or tell me what you'd like to change.`,
              },
            ],
          },
        ]
      : [],
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={`agent-chat-backdrop ${open ? "open" : ""}`} onClick={onClose}>
      <div className={`agent-chat`} role="dialog" aria-label="Agent chat" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-chat-header">
          <span className="agent-chat-title">
            <span className="agent-chat-dot" />
            Agent
            {contextNodeId && (
              <span className="agent-chat-context-badge">{contextNodeId}</span>
            )}
          </span>
          <button className="agent-chat-close" onClick={onClose} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Thread */}
        <ThreadPrimitive.Root className="agent-chat-thread">
          <ThreadPrimitive.Viewport className="agent-chat-viewport">
            <ThreadPrimitive.Empty>
              <div className="agent-chat-empty">
                {contextNodeId
                  ? `Ask about ${contextNodeId}, or request changes to it.`
                  : "Select a spec node on the graph, then ask me to refine or create specs."}
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages
              components={{ UserMessage, AssistantMessage }}
            />

            <ThreadPrimitive.ScrollToBottom className="agent-chat-scroll-btn">
              <FontAwesomeIcon icon={faChevronDown} />
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.Viewport>

          {/* Composer */}
          <div className="agent-chat-composer-wrap">
            <ComposerPrimitive.Root className="agent-chat-composer">
              <ComposerPrimitive.Input
                className="agent-chat-input"
                placeholder="Ask the agent…"
                autoFocus
              />
              <ComposerPrimitive.Send className="agent-chat-send">
                <FontAwesomeIcon icon={faPaperPlane} />
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.Root>
      </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

// ── Message components ────────────────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="agent-msg agent-msg-user">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="agent-msg agent-msg-assistant">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

// ── Trigger button (rendered outside the modal) ───────────────────────────────

interface AgentChatTriggerProps {
  onClick: () => void;
  active: boolean;
}

export function AgentChatTrigger({ onClick, active }: AgentChatTriggerProps) {
  return (
    <button
      className={`agent-chat-trigger ${active ? "active" : ""}`}
      onClick={onClick}
      title="Open agent chat"
    >
      <FontAwesomeIcon icon={faWandMagicSparkles} />
    </button>
  );
}
