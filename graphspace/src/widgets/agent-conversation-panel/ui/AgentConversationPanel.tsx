import { type FormEvent, useCallback, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import {
  agentContextItemKey,
  createAgentRuntimeProjection,
  projectAgentRuntimeEvent,
  serializeAgentContextSet,
  type AgentContextDraft,
  type AgentContextItem,
  type AgentConversationRef,
  type AgentConversationRuntime,
  type AgentRuntimeProjection,
  type AgentRuntimeTurnProjection,
} from "@/entities/agent-workbench";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import { createAssistantUiExternalStoreAdapter } from "../model/assistant-ui-adapter";
import styles from "./AgentConversationPanel.module.css";

type AgentConversationPanelStatus = "idle" | "starting" | "streaming" | "active" | "error";

type Props = {
  runtime: AgentConversationRuntime;
  draft: AgentContextDraft;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
};

export function AgentConversationPanel({
  runtime,
  draft,
  resolveSpecRef,
  onSpecIdClick,
}: Props) {
  const serializedContext = useMemo(() => serializeAgentContextSet(draft), [draft]);
  const [conversation, setConversation] = useState<AgentConversationRef | null>(null);
  const [projection, setProjection] = useState<AgentRuntimeProjection>(() =>
    createAgentRuntimeProjection(),
  );
  const [prompt, setPrompt] = useState("Review selected context and suggest the next proposal.");
  const [status, setStatus] = useState<AgentConversationPanelStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const isBusy = status === "starting" || status === "streaming";
  const hasPrompt = prompt.trim().length > 0;
  const assistantUiStore = useMemo(
    () =>
      createAssistantUiExternalStoreAdapter({
        projection,
        is_running: isBusy,
      }),
    [projection, isBusy],
  );
  const assistantUiRuntime = useExternalStoreRuntime(assistantUiStore);

  const streamMessage = useCallback(
    async (ref: AgentConversationRef, text: string) => {
      setStatus("streaming");
      for await (const event of runtime.sendMessage({
        conversation_id: ref.conversation_id,
        text,
        context_set: serializedContext,
      })) {
        setProjection((current) => projectAgentRuntimeEvent(current, event));
      }
      setStatus("active");
    },
    [runtime, serializedContext],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isBusy) return;

    setError(null);
    setPrompt("");

    try {
      let ref = conversation;
      if (!ref) {
        setStatus("starting");
        ref = await runtime.startConversation({
          title: createConversationTitle(text),
          context_set: serializedContext,
          initial_prompt: text,
        });
        setConversation(ref);
      }

      await streamMessage(ref, text);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Conversation runtime failed.");
    }
  };

  return (
    <section className={styles.panel} aria-label="Agent conversation">
      <div className={styles.summary}>
        <Metric label="Turns" value={projection.turns.length} />
        <Metric label="Context" value={serializedContext.items.length} />
        <Metric label="Outputs" value={countOutputs(projection)} />
      </div>

      <div className={styles.runtimeBar}>
        <span className={styles.runtimeBadge}>Mock runtime</span>
        <span className={styles.runtimeText}>
          {conversation
            ? `${conversation.conversation_id} · ${status}`
            : "No conversation started"}
        </span>
      </div>

      <div className={styles.contextStrip} aria-label="Conversation context">
        {serializedContext.items.length === 0 ? (
          <span className={styles.contextEmpty}>No context items attached.</span>
        ) : (
          serializedContext.items.map((item) => (
            <span className={styles.contextToken} key={agentContextItemKey(item)}>
              <AgentContextToken
                item={item}
                resolveSpecRef={resolveSpecRef}
                onSpecIdClick={onSpecIdClick}
              />
            </span>
          ))
        )}
      </div>

      <AssistantRuntimeProvider runtime={assistantUiRuntime}>
        <ThreadPrimitive.Root
          className={styles.transcript}
          aria-live="polite"
          data-agent-ui-adapter="assistant-ui"
        >
          {projection.turns.length === 0 ? (
            <Status
              label="Conversation not started"
              detail="Send a prompt to create a local mock conversation from the current Agent context draft."
            />
          ) : (
            projection.turns.map((turn) => (
              <TurnView
                key={turn.turn_id}
                turn={turn}
                resolveSpecRef={resolveSpecRef}
                onSpecIdClick={onSpecIdClick}
              />
            ))
          )}
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <label className={styles.composerLabel} htmlFor="agent-conversation-prompt">
          Prompt
        </label>
        <textarea
          id="agent-conversation-prompt"
          className={styles.promptInput}
          value={prompt}
          disabled={isBusy}
          rows={4}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!hasPrompt || isBusy}
        >
          {conversation ? "Send" : "Start Conversation"}
        </button>
      </form>
    </section>
  );
}

function AgentContextToken({
  item,
  resolveSpecRef,
  onSpecIdClick,
}: {
  item: AgentContextItem;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (item.kind === "proposal") {
    return <span>{item.proposal_id}</span>;
  }
  if (item.kind === "metric") {
    return <span>{item.item_id}</span>;
  }
  if (item.kind === "spec_edge") {
    return <span>{item.edge_id}</span>;
  }
  if (item.kind === "spec_gap") {
    return (
      <span>
        <SpecIdText
          text={item.node_id}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />{" "}
        {item.gap_kind}
      </span>
    );
  }
  return (
    <SpecIdText
      text={item.node_id}
      resolveSpecRef={resolveSpecRef}
      onSpecIdClick={onSpecIdClick}
      variant="bare"
    />
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function TurnView({
  turn,
  resolveSpecRef,
  onSpecIdClick,
}: {
  turn: AgentRuntimeTurnProjection;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  return (
    <article className={styles.turn} data-role={turn.role}>
      <div className={styles.turnHeader}>
        <span className={styles.role}>{turn.role}</span>
        <span className={styles.turnState}>{turn.completed ? "complete" : "streaming"}</span>
      </div>
      <p className={styles.turnText}>
        <SpecIdText
          text={turn.text}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="inline"
        />
      </p>
      {turn.tool_calls.length > 0 ? (
        <div className={styles.turnArtifacts} aria-label="Tool calls">
          {turn.tool_calls.map((toolCall) => (
            <span className={styles.artifactPill} key={toolCall.tool_call_id}>
              {toolCall.title}
            </span>
          ))}
        </div>
      ) : null}
      {turn.outputs.length > 0 ? (
        <div className={styles.turnArtifacts} aria-label="Outputs">
          {turn.outputs.map((output) => (
            <span className={styles.artifactPill} key={output.output_id}>
              {output.output_kind}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.statusBox}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}

function countOutputs(projection: AgentRuntimeProjection): number {
  return projection.turns.reduce((count, turn) => count + turn.outputs.length, 0);
}

function createConversationTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}
