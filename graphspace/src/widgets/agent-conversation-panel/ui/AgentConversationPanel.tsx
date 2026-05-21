import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import {
  agentContextItemLabel,
  agentContextItemKey,
  isAgentConversationArtifactRuntime,
  createAgentRuntimeProjection,
  isAgentConversationHistoryRuntime,
  projectAgentRuntimeEvent,
  serializeAgentContextSet,
  type AgentConversationArtifact,
  type AgentConversationHistoryEntry,
  type AgentConversationPromptSeed,
  type AgentContextDraft,
  type AgentContextItem,
  type AgentConversationId,
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
  promptSeed?: AgentConversationPromptSeed | null;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  onRemoveContextItem?: (key: string) => void;
};

const DEFAULT_PROMPT = "Review selected context and suggest the next proposal.";

export function AgentConversationPanel({
  runtime,
  draft,
  promptSeed = null,
  resolveSpecRef,
  onSpecIdClick,
  onRemoveContextItem,
}: Props) {
  const serializedContext = useMemo(() => serializeAgentContextSet(draft), [draft]);
  const [conversation, setConversation] = useState<AgentConversationRef | null>(null);
  const [projection, setProjection] = useState<AgentRuntimeProjection>(() =>
    createAgentRuntimeProjection(),
  );
  const [prompt, setPrompt] = useState(promptSeed?.prompt ?? DEFAULT_PROMPT);
  const [status, setStatus] = useState<AgentConversationPanelStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const isBusy = status === "starting" || status === "streaming";
  const hasPrompt = prompt.trim().length > 0;
  const historyRuntime = useMemo(
    () => (isAgentConversationHistoryRuntime(runtime) ? runtime : null),
    [runtime],
  );
  const artifactRuntime = useMemo(
    () => (isAgentConversationArtifactRuntime(runtime) ? runtime : null),
    [runtime],
  );
  const conversationHistory = useMemo(
    () => (historyRuntime ? historyRuntime.listConversations() : []),
    [historyRuntime, historyVersion],
  );
  const conversationArtifact = useMemo(
    () => {
      if (!artifactRuntime || !conversation) return null;
      return artifactRuntime.getConversationArtifact(conversation.conversation_id);
    },
    [artifactRuntime, conversation?.conversation_id, historyVersion],
  );
  const assistantUiStore = useMemo(
    () =>
      createAssistantUiExternalStoreAdapter({
        projection,
        is_running: isBusy,
      }),
    [projection, isBusy],
  );
  const assistantUiRuntime = useExternalStoreRuntime(assistantUiStore);

  useEffect(() => {
    if (!promptSeed || conversation || isBusy) return;
    setPrompt(promptSeed.prompt);
  }, [conversation, isBusy, promptSeed]);

  const refreshHistory = useCallback(() => {
    setHistoryVersion((current) => current + 1);
  }, []);

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
      refreshHistory();
      setStatus("active");
    },
    [refreshHistory, runtime, serializedContext],
  );

  const handleStartFresh = useCallback(() => {
    if (isBusy) return;
    setConversation(null);
    setProjection(createAgentRuntimeProjection());
    setPrompt(promptSeed?.prompt ?? DEFAULT_PROMPT);
    setStatus("idle");
    setError(null);
  }, [isBusy, promptSeed]);

  const handleResumeConversation = useCallback(
    async (conversationId: AgentConversationId) => {
      if (!historyRuntime || isBusy) return;
      const record = historyRuntime.getConversation(conversationId);
      if (!record) {
        setStatus("error");
        setError("Conversation history entry is unavailable.");
        refreshHistory();
        return;
      }

      setConversation(record.ref);
      setProjection(createAgentRuntimeProjection());
      setPrompt(DEFAULT_PROMPT);
      setStatus("streaming");
      setError(null);

      try {
        for await (const event of historyRuntime.resumeConversation(conversationId)) {
          setProjection((current) => projectAgentRuntimeEvent(current, event));
        }
        setStatus("active");
        refreshHistory();
      } catch (cause) {
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Conversation history resume failed.");
      }
    },
    [historyRuntime, isBusy, refreshHistory],
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

      {historyRuntime ? (
        <ConversationHistory
          conversations={conversationHistory}
          currentConversationId={conversation?.conversation_id ?? null}
          isBusy={isBusy}
          onResume={handleResumeConversation}
          onStartFresh={handleStartFresh}
        />
      ) : null}

      {artifactRuntime && conversation ? (
        <ConversationArtifactSnapshot artifact={conversationArtifact} />
      ) : null}

      <div className={styles.contextStrip} aria-label="Conversation context">
        {serializedContext.items.length === 0 ? (
          <span className={styles.contextEmpty}>No context items attached.</span>
        ) : (
          serializedContext.items.map((item) => {
            const key = agentContextItemKey(item);

            return (
              <span className={styles.contextToken} key={key}>
                <AgentContextToken
                  item={item}
                  resolveSpecRef={resolveSpecRef}
                  onSpecIdClick={onSpecIdClick}
                />
                {onRemoveContextItem ? (
                  <button
                    type="button"
                    className={styles.contextTokenRemove}
                    onClick={() => onRemoveContextItem(key)}
                    aria-label={`Remove ${agentContextItemLabel(item)} from Agent context`}
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            );
          })
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

function ConversationHistory({
  conversations,
  currentConversationId,
  isBusy,
  onResume,
  onStartFresh,
}: {
  conversations: AgentConversationHistoryEntry[];
  currentConversationId: AgentConversationId | null;
  isBusy: boolean;
  onResume: (conversationId: AgentConversationId) => void;
  onStartFresh: () => void;
}) {
  return (
    <div className={styles.historyPanel} aria-label="Local conversation history">
      <div className={styles.historyHeader}>
        <span className={styles.historyTitle}>Conversation history</span>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isBusy}
          onClick={onStartFresh}
        >
          New
        </button>
      </div>
      {conversations.length === 0 ? (
        <span className={styles.historyEmpty}>No local conversations yet.</span>
      ) : (
        <div className={styles.historyList}>
          {conversations.map((entry) => {
            const isCurrent = entry.ref.conversation_id === currentConversationId;

            return (
              <button
                type="button"
                key={entry.ref.conversation_id}
                className={`${styles.historyButton} ${
                  isCurrent ? styles.historyButtonActive : ""
                }`}
                disabled={isBusy || isCurrent}
                onClick={() => onResume(entry.ref.conversation_id)}
                title={entry.ref.title}
              >
                <span className={styles.historyButtonTitle}>{entry.ref.title}</span>
                <span className={styles.historyMeta}>{formatHistoryMeta(entry)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConversationArtifactSnapshot({
  artifact,
}: {
  artifact: AgentConversationArtifact | null;
}) {
  const contextItemCount = useMemo(
    () => (artifact ? countArtifactContextItems(artifact) : 0),
    [artifact],
  );
  const artifactSummary = useMemo(
    () => (artifact ? formatArtifactSummary(artifact) : ""),
    [artifact],
  );

  if (!artifact) {
    return (
      <div className={styles.artifactPanel} aria-label="Conversation artifact snapshot">
        <div className={styles.artifactHeader}>
          <span className={styles.artifactTitle}>Artifact snapshot</span>
          <span className={styles.artifactMeta}>Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.artifactPanel} aria-label="Conversation artifact snapshot">
      <div className={styles.artifactHeader}>
        <span className={styles.artifactTitle}>Artifact snapshot</span>
        <span className={styles.artifactMeta}>
          {artifact.artifact_kind} · {artifact.api_version} · schema {artifact.schema_version}
        </span>
      </div>
      <div className={styles.artifactStats}>
        <ArtifactStat label="Turns" value={artifact.turns.length} />
        <ArtifactStat label="Outputs" value={artifact.outputs.length} />
        <ArtifactStat label="Context" value={contextItemCount} />
      </div>
      <dl className={styles.artifactFacts}>
        <div>
          <dt>Owner</dt>
          <dd>{artifact.storage.owner}</dd>
        </div>
        <div>
          <dt>Authority</dt>
          <dd>{artifact.storage.mutation_authority}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{artifact.status}</dd>
        </div>
      </dl>
      <details className={styles.artifactDetails}>
        <summary>Readonly artifact summary</summary>
        <pre>{artifactSummary}</pre>
      </details>
    </div>
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
  if (item.kind === "spec_markdown") {
    return (
      <span>
        <SpecIdText
          text={item.node_id}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />{" "}
        {item.source_kind === "hyperprompt_compile" ? "compiled" : "markdown"}
      </span>
    );
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

function ArtifactStat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.artifactStat}>
      <span className={styles.artifactStatValue}>{value}</span>
      <span className={styles.artifactStatLabel}>{label}</span>
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

function countArtifactContextItems(artifact: AgentConversationArtifact): number {
  return artifact.context_sets.reduce((count, contextSet) => count + contextSet.items.length, 0);
}

function formatArtifactSummary(artifact: AgentConversationArtifact): string {
  return JSON.stringify(
    {
      artifact_kind: artifact.artifact_kind,
      api_version: artifact.api_version,
      schema_version: artifact.schema_version,
      conversation_id: artifact.conversation_id,
      storage: artifact.storage,
      counts: {
        context_sets: artifact.context_sets.length,
        context_items: countArtifactContextItems(artifact),
        turns: artifact.turns.length,
        outputs: artifact.outputs.length,
      },
      outputs: artifact.outputs.map((output) => ({
        output_id: output.output_id,
        kind: output.kind,
        origin_turn_id: output.origin_turn_id,
      })),
    },
    null,
    2,
  );
}

function formatHistoryMeta(entry: AgentConversationHistoryEntry): string {
  const contextCount = entry.context_set.items.length;
  return `${entry.turn_count} ${entry.turn_count === 1 ? "turn" : "turns"} · ${
    contextCount
  } context ${contextCount === 1 ? "item" : "items"}`;
}

function createConversationTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}
