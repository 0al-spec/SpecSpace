import {
  agentContextItemKey,
  serializeAgentContextSet,
  type AgentContextDraft,
  type AgentContextItem,
} from "@/entities/agent-workbench";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import styles from "./AgentContextPanel.module.css";

type Props = {
  draft: AgentContextDraft;
  selectedNode: SpecNode | null;
  selectedEdge: SpecEdge | null;
  resolveSpecRef?: SpecRefResolver;
  onAddSelectedSpec: () => void;
  onAddSelectedEdge: () => void;
  onRemoveItem: (key: string) => void;
  onClear: () => void;
  onOpenConversation?: () => void;
};

export function AgentContextPanel({
  draft,
  selectedNode,
  selectedEdge,
  resolveSpecRef,
  onAddSelectedSpec,
  onAddSelectedEdge,
  onRemoveItem,
  onClear,
  onOpenConversation,
}: Props) {
  const serialized = serializeAgentContextSet(draft);
  const selectedKey = selectedNode ? `spec_node:${selectedNode.node_id}` : null;
  const selectedEdgeKey = selectedEdge ? `spec_edge:${selectedEdge.edge_id}` : null;
  const selectedAlreadyAdded =
    selectedKey !== null && draft.items.some((item) => agentContextItemKey(item) === selectedKey);
  const selectedEdgeAlreadyAdded =
    selectedEdgeKey !== null &&
    draft.items.some((item) => agentContextItemKey(item) === selectedEdgeKey);

  return (
    <section className={styles.panel} aria-label="Agent context">
      <div className={styles.summary}>
        <Metric label="Items" value={draft.items.length} />
        <Metric
          label="Specs"
          value={draft.items.filter((item) => item.kind === "spec_node").length}
        />
        <Metric
          label="Edges"
          value={draft.items.filter((item) => item.kind === "spec_edge").length}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onAddSelectedSpec}
          disabled={!selectedNode || selectedAlreadyAdded}
        >
          {selectedNode
            ? selectedAlreadyAdded
              ? "Selected Spec Added"
              : "Add Selected Spec"
            : "Select A Spec First"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onAddSelectedEdge}
          disabled={!selectedEdge || selectedEdgeAlreadyAdded}
        >
          {selectedEdge
            ? selectedEdgeAlreadyAdded
              ? "Selected Edge Added"
              : "Add Selected Edge"
            : "Select An Edge First"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClear}
          disabled={draft.items.length === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onOpenConversation}
          disabled={!onOpenConversation}
          title={
            onOpenConversation
              ? "Open Agent conversation"
              : "Agent execution is not wired yet."
          }
        >
          Open Conversation
        </button>
      </div>

      {selectedNode ? (
        <div className={styles.selectedContext}>
          <span className={styles.kicker}>Selected spec</span>
          <strong>
            <SpecIdText
              text={selectedNode.node_id}
              resolveSpecRef={resolveSpecRef}
              variant="bare"
            />
          </strong>
          <span>{selectedNode.title}</span>
        </div>
      ) : selectedEdge ? (
        <div className={styles.selectedContext}>
          <span className={styles.kicker}>Selected edge</span>
          <strong>{selectedEdge.edge_id}</strong>
          <span>
            {selectedEdge.edge_kind} · {selectedEdge.source_id} → {selectedEdge.target_id}
          </span>
        </div>
      ) : (
        <Status
          label="No selected graph item"
          detail="Select a node or edge on the canvas, then add it to the context draft."
        />
      )}

      <div className={styles.entries}>
        {draft.items.length === 0 ? (
          <Status
            label="Context is empty"
            detail="The draft is local UI state and has not been sent to an agent."
          />
        ) : (
          draft.items.map((item) => (
            <ContextItemRow
              key={agentContextItemKey(item)}
              item={item}
              resolveSpecRef={resolveSpecRef}
              onRemoveItem={onRemoveItem}
            />
          ))
        )}
      </div>

      <details className={styles.preview}>
        <summary>Serialized context_set</summary>
        <pre>{JSON.stringify(serialized, null, 2)}</pre>
      </details>
    </section>
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

function ContextItemRow({
  item,
  resolveSpecRef,
  onRemoveItem,
}: {
  item: AgentContextItem;
  resolveSpecRef?: SpecRefResolver;
  onRemoveItem: (key: string) => void;
}) {
  const key = agentContextItemKey(item);

  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.itemKind}>{item.kind}</span>
        <button
          type="button"
          className={styles.removeButton}
          onClick={() => onRemoveItem(key)}
        >
          Remove
        </button>
      </div>
      <h3 className={styles.title}>
        {item.kind === "spec_node" ? (
          <SpecIdText
            text={item.node_id}
            resolveSpecRef={resolveSpecRef}
            variant="bare"
          />
        ) : item.kind === "spec_edge" ? (
          <span>{item.edge_id}</span>
        ) : (
          <span>{item.proposal_id}</span>
        )}
      </h3>
      <p className={styles.detail}>
        {item.kind === "spec_edge"
          ? `${item.source_title ?? item.source_id} → ${item.target_title ?? item.target_id}`
          : item.title}
      </p>
      <div className={styles.meta}>
        <span>{item.status}</span>
        <span>
          {item.kind === "spec_node"
            ? item.file_name
            : item.kind === "spec_edge"
              ? item.edge_kind
              : item.proposal_path ?? "proposal artifact"}
        </span>
      </div>
      {item.kind === "proposal" && item.affected_spec_ids.length > 0 ? (
        <div className={styles.meta}>
          {item.affected_spec_ids.slice(0, 4).map((specId) => (
            <SpecIdText
              key={specId}
              text={specId}
              resolveSpecRef={resolveSpecRef}
              variant="chip"
            />
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
