import {
  agentContextItemKey,
  serializeAgentContextSet,
  type AgentContextDraft,
  type AgentContextItem,
} from "@/entities/agent-workbench";
import type { SpecNode } from "@/entities/spec-node";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import styles from "./AgentContextPanel.module.css";

type Props = {
  draft: AgentContextDraft;
  selectedNode: SpecNode | null;
  resolveSpecRef?: SpecRefResolver;
  onAddSelectedSpec: () => void;
  onRemoveItem: (key: string) => void;
  onClear: () => void;
};

export function AgentContextPanel({
  draft,
  selectedNode,
  resolveSpecRef,
  onAddSelectedSpec,
  onRemoveItem,
  onClear,
}: Props) {
  const serialized = serializeAgentContextSet(draft);
  const selectedKey = selectedNode ? `spec_node:${selectedNode.node_id}` : null;
  const selectedAlreadyAdded =
    selectedKey !== null && draft.items.some((item) => agentContextItemKey(item) === selectedKey);

  return (
    <section className={styles.panel} aria-label="Agent context">
      <div className={styles.summary}>
        <Metric label="Items" value={draft.items.length} />
        <Metric
          label="Specs"
          value={draft.items.filter((item) => item.kind === "spec_node").length}
        />
        <Metric label="Outputs" value={0} />
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
          onClick={onClear}
          disabled={draft.items.length === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled
          title="Agent execution is not wired yet."
        >
          Start Conversation
        </button>
      </div>

      {selectedNode ? (
        <div className={styles.selectedNode}>
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
      ) : (
        <Status
          label="No selected spec"
          detail="Select a node on the canvas or in the Sidebar, then add it to the context draft."
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
        <SpecIdText
          text={item.node_id}
          resolveSpecRef={resolveSpecRef}
          variant="bare"
        />
      </h3>
      <p className={styles.detail}>{item.title}</p>
      <div className={styles.meta}>
        <span>{item.status}</span>
        <span>{item.file_name}</span>
      </div>
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
