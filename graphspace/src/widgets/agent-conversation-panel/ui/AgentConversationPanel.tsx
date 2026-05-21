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
  fetchAgentConversationArtifact,
  isAgentConversationHistoryRuntime,
  projectAgentConversationArtifactToProjection,
  projectAgentRuntimeEvent,
  serializeAgentContextSet,
  type AgentConversationArtifact,
  type AgentConversationContextItem,
  type AgentConversationHistoryEntry,
  type AgentConversationIndexArtifact,
  type AgentConversationIndexEntry,
  type AgentConversationPromptSeed,
  type AgentContextDraft,
  type AgentContextItem,
  type AgentConversationId,
  type AgentConversationRef,
  type AgentConversationRuntime,
  type AgentRuntimeProjection,
  type AgentRuntimeTurnProjection,
  type AgentWorkbenchReadResult,
} from "@/entities/agent-workbench";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import { createAssistantUiExternalStoreAdapter } from "../model/assistant-ui-adapter";
import {
  useAgentWorkbenchConversationIndex,
  type AgentWorkbenchConversationIndexState,
} from "../model/use-agent-workbench-conversation-index";
import styles from "./AgentConversationPanel.module.css";

type AgentConversationPanelStatus = "idle" | "starting" | "streaming" | "active" | "error";
type StoredArtifactState =
  | { kind: "idle" }
  | { kind: "loading"; conversationId: AgentConversationId }
  | { kind: "ok"; artifact: AgentConversationArtifact }
  | { kind: "error"; conversationId: AgentConversationId; message: string };

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
  const [storeRefreshKey, setStoreRefreshKey] = useState(0);
  const [storedArtifactState, setStoredArtifactState] = useState<StoredArtifactState>({
    kind: "idle",
  });
  const isBusy = status === "starting" || status === "streaming";
  const storedArtifact =
    storedArtifactState.kind === "ok" ? storedArtifactState.artifact : null;
  const isReadonlyStoredConversation =
    !!storedArtifact && conversation?.conversation_id === storedArtifact.conversation_id;
  const storedContextItems = useMemo(
    () => (isReadonlyStoredConversation ? flattenArtifactContextItems(storedArtifact) : []),
    [isReadonlyStoredConversation, storedArtifact],
  );
  const activeContextCount = isReadonlyStoredConversation
    ? storedContextItems.length
    : serializedContext.items.length;
  const hasPrompt = prompt.trim().length > 0;
  const storeIndexState = useAgentWorkbenchConversationIndex({
    refreshKey: storeRefreshKey,
  });
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
  const localConversationArtifact = useMemo(
    () => {
      if (!artifactRuntime || !conversation) return null;
      return artifactRuntime.getConversationArtifact(conversation.conversation_id);
    },
    [artifactRuntime, conversation?.conversation_id, historyVersion],
  );
  const activeConversationArtifact = storedArtifact ?? localConversationArtifact;
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
  const refreshStoreIndex = useCallback(() => {
    setStoreRefreshKey((current) => current + 1);
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
    setStoredArtifactState({ kind: "idle" });
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

      setStoredArtifactState({ kind: "idle" });
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

  const handleOpenStoredConversation = useCallback(
    async (conversationId: AgentConversationId) => {
      if (isBusy) return;
      setStoredArtifactState({ kind: "loading", conversationId });
      setStatus("starting");
      setError(null);

      try {
        const result = await fetchAgentConversationArtifact({ conversationId });
        if (result.kind !== "ok") {
          const message = describeWorkbenchReadFailure(result);
          setStoredArtifactState({ kind: "error", conversationId, message });
          setStatus("error");
          setError(message);
          return;
        }

        setStoredArtifactState({ kind: "ok", artifact: result.data });
        setConversation({
          conversation_id: result.data.conversation_id,
          title: result.data.title,
          status: result.data.status,
        });
        setProjection(projectAgentConversationArtifactToProjection(result.data));
        setPrompt(DEFAULT_PROMPT);
        setStatus("active");
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        const message =
          cause instanceof Error
            ? cause.message
            : "Agent Workbench conversation artifact could not be loaded.";
        setStoredArtifactState({ kind: "error", conversationId, message });
        setStatus("error");
        setError(message);
      }
    },
    [isBusy],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isBusy) return;
    if (isReadonlyStoredConversation) {
      setStatus("error");
      setError("Readonly Workbench artifacts cannot be appended yet. Start a new conversation to continue.");
      return;
    }

    setError(null);
    setPrompt("");

    try {
      let ref = conversation;
      if (!ref) {
        setStoredArtifactState({ kind: "idle" });
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
        <Metric label="Context" value={activeContextCount} />
        <Metric label="Outputs" value={countOutputs(projection)} />
      </div>

      <div className={styles.runtimeBar}>
        <span className={styles.runtimeBadge}>
          {isReadonlyStoredConversation ? "Readonly store" : "Mock runtime"}
        </span>
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

      <StoredConversationIndex
        state={storeIndexState}
        selectedArtifactState={storedArtifactState}
        currentConversationId={conversation?.conversation_id ?? null}
        currentIsStored={isReadonlyStoredConversation}
        isBusy={isBusy}
        onOpen={handleOpenStoredConversation}
        onRefresh={refreshStoreIndex}
      />

      {(artifactRuntime && conversation) || storedArtifact ? (
        <ConversationArtifactSnapshot artifact={activeConversationArtifact} />
      ) : null}

      <div className={styles.contextStrip} aria-label="Conversation context">
        {isReadonlyStoredConversation ? (
          storedContextItems.length === 0 ? (
            <span className={styles.contextEmpty}>No context items attached.</span>
          ) : (
            storedContextItems.map((item, index) => (
              <span className={styles.contextToken} key={storedContextItemKey(item, index)}>
                <StoredArtifactContextToken
                  item={item}
                  resolveSpecRef={resolveSpecRef}
                  onSpecIdClick={onSpecIdClick}
                />
              </span>
            ))
          )
        ) : serializedContext.items.length === 0 ? (
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
      {isReadonlyStoredConversation ? (
        <p className={styles.readonlyNotice}>
          Readonly Workbench artifact. Start a new conversation to continue with new turns.
        </p>
      ) : null}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <label className={styles.composerLabel} htmlFor="agent-conversation-prompt">
          Prompt
        </label>
        <textarea
          id="agent-conversation-prompt"
          className={styles.promptInput}
          value={prompt}
          disabled={isBusy || isReadonlyStoredConversation}
          rows={4}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!hasPrompt || isBusy || isReadonlyStoredConversation}
        >
          {isReadonlyStoredConversation ? "Readonly Artifact" : conversation ? "Send" : "Start Conversation"}
        </button>
      </form>
    </section>
  );
}

function StoredConversationIndex({
  state,
  selectedArtifactState,
  currentConversationId,
  currentIsStored,
  isBusy,
  onOpen,
  onRefresh,
}: {
  state: AgentWorkbenchConversationIndexState;
  selectedArtifactState: StoredArtifactState;
  currentConversationId: AgentConversationId | null;
  currentIsStored: boolean;
  isBusy: boolean;
  onOpen: (conversationId: AgentConversationId) => void;
  onRefresh: () => void;
}) {
  return (
    <div className={styles.historyPanel} aria-label="Readonly Workbench conversation store">
      <div className={styles.historyHeader}>
        <span className={styles.historyTitle}>Workbench store</span>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isBusy || state.kind === "loading"}
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
      {state.kind === "ok" ? (
        state.data.entries.length === 0 ? (
          <span className={styles.historyEmpty}>Readonly store is initialized but empty.</span>
        ) : (
          <div className={styles.historyList}>
            {state.data.entries.map((entry) => {
              const isCurrent =
                currentIsStored && entry.conversation_id === currentConversationId;
              const isLoading =
                selectedArtifactState.kind === "loading" &&
                selectedArtifactState.conversationId === entry.conversation_id;

              return (
                <button
                  type="button"
                  key={entry.conversation_id}
                  className={`${styles.historyButton} ${
                    isCurrent ? styles.historyButtonActive : ""
                  }`}
                  disabled={isBusy || isCurrent || isLoading}
                  onClick={() => onOpen(entry.conversation_id)}
                  title={entry.title}
                >
                  <span className={styles.historyButtonTitle}>{entry.title}</span>
                  <span className={styles.historyMeta}>{formatStoredIndexMeta(entry)}</span>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <span className={styles.historyEmpty}>{describeWorkbenchIndexState(state)}</span>
      )}
      {selectedArtifactState.kind === "error" ? (
        <span className={styles.storeError}>{selectedArtifactState.message}</span>
      ) : null}
    </div>
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

function StoredArtifactContextToken({
  item,
  resolveSpecRef,
  onSpecIdClick,
}: {
  item: AgentConversationContextItem;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (item.kind === "spec_node") {
    return (
      <SpecIdText
        text={item.node_id}
        resolveSpecRef={resolveSpecRef}
        onSpecIdClick={onSpecIdClick}
        variant="bare"
      />
    );
  }
  if (item.kind === "spec_edge") {
    return (
      <span>
        <SpecIdText
          text={item.source_node_id}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />{" "}
        -&gt;{" "}
        <SpecIdText
          text={item.target_node_id}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />
      </span>
    );
  }
  if (item.kind === "gap") {
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
  if (item.kind === "proposal") {
    return <span>{item.proposal_id}</span>;
  }
  if (item.kind === "metric") {
    return <span>{item.item_id}</span>;
  }
  if (item.kind === "specpm_package") {
    return <span>{item.package_id}</span>;
  }
  return (
    <span>
      <SpecIdText
        text={item.node_id}
        resolveSpecRef={resolveSpecRef}
        onSpecIdClick={onSpecIdClick}
        variant="bare"
      />{" "}
      {item.source_kind}
    </span>
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

function flattenArtifactContextItems(
  artifact: AgentConversationArtifact | null,
): AgentConversationContextItem[] {
  if (!artifact) return [];
  return artifact.context_sets.flatMap((contextSet) => contextSet.items);
}

function storedContextItemKey(item: AgentConversationContextItem, index: number): string {
  if (item.kind === "spec_node") return `stored-spec-node:${item.node_id}:${index}`;
  if (item.kind === "spec_edge") return `stored-spec-edge:${item.edge_id}:${index}`;
  if (item.kind === "gap") return `stored-gap:${item.gap_id}:${index}`;
  if (item.kind === "proposal") return `stored-proposal:${item.proposal_key}:${index}`;
  if (item.kind === "metric") return `stored-metric:${item.metric_key}:${index}`;
  if (item.kind === "specpm_package") return `stored-specpm:${item.package_id}:${index}`;
  return `stored-link:${item.artifact_path}:${index}`;
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

function formatStoredIndexMeta(entry: AgentConversationIndexEntry): string {
  return `${entry.turn_count} ${entry.turn_count === 1 ? "turn" : "turns"} · ${
    entry.context_item_count
  } context · ${entry.output_count} ${entry.output_count === 1 ? "output" : "outputs"}`;
}

function describeWorkbenchIndexState(state: AgentWorkbenchConversationIndexState): string {
  if (state.kind === "idle" || state.kind === "loading") {
    return "Loading readonly Workbench store.";
  }
  if (state.kind === "ok") {
    return "Readonly Workbench store is available.";
  }
  return describeWorkbenchReadFailure(state);
}

function describeWorkbenchReadFailure(
  result: Exclude<
    AgentWorkbenchReadResult<AgentConversationArtifact | AgentConversationIndexArtifact>,
    { kind: "ok" }
  >,
): string {
  if (result.kind === "http-error") {
    const detail = describeHttpErrorBody(result.body);
    if (result.status === 503) {
      return detail ?? "Readonly Workbench store is not configured.";
    }
    return detail ?? `Readonly Workbench store returned HTTP ${result.status}.`;
  }
  if (result.kind === "network-error") {
    return "Readonly Workbench store could not be reached.";
  }
  if (result.kind === "response-error") {
    return result.reason;
  }
  if (result.kind === "wrong-artifact-kind") {
    return `Expected ${result.expected}; received ${String(result.got)}.`;
  }
  if (result.kind === "version-not-supported") {
    return `${result.artifact_kind} schema ${result.schema_version} is newer than supported schema ${result.max_supported}.`;
  }
  return result.reason;
}

function describeHttpErrorBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.length > 0) return record.error;
  if (typeof record.detail === "string" && record.detail.length > 0) return record.detail;
  const source = record.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const detail = (source as Record<string, unknown>).detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
  }
  return null;
}

function createConversationTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}
