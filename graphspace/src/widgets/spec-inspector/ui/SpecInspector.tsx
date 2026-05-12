import { useState, type HTMLAttributes } from "react";
import {
  buildSpecInspectorModel,
  type SpecInspectorSelection,
  type SpecRelationGroup,
  type SpecRelation,
} from "../model";
import styles from "./SpecInspector.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  selection: SpecInspectorSelection;
  onClose: () => void;
  onSelectNodeId?: (nodeId: string) => void;
};

export function SpecInspector({
  selection,
  onClose,
  onSelectNodeId,
  className,
  ...rest
}: Props) {
  const [copied, setCopied] = useState(false);
  const model = buildSpecInspectorModel(selection);
  const { node } = model;
  const cls = [styles.panel, className].filter(Boolean).join(" ");
  const copyFilePath = () => {
    void navigator.clipboard.writeText(model.filePath).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <aside className={cls} aria-label="Spec inspector" {...rest}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.id}>{node.node_id}</span>
          <span className={styles.status}>{node.status}</span>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.scroll}>
        <h2 className={styles.title}>{node.title}</h2>

        <dl className={styles.metaGrid}>
          <Field label="Kind" value={node.kind} />
          <Field label="Maturity" value={model.maturityLabel} />
          <Field label="Acceptance" value={String(node.acceptance_count)} />
          <Field label="Decisions" value={String(node.decisions_count)} />
          <Field label="Gaps" value={String(node.gap_count)} />
          <div className={`${styles.field} ${styles.wide}`}>
            <div className={styles.fieldHeader}>
              <dt>File</dt>
              <button
                type="button"
                className={styles.copyButton}
                onClick={copyFilePath}
              >
                {copied ? "Copied" : "Copy Path"}
              </button>
            </div>
            <dd className={styles.fileValue}>{model.filePath}</dd>
          </div>
        </dl>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Gap profile</h3>
          <div className={styles.metricRow}>
            <Metric label="Evidence" value={node.evidence_gap} />
            <Metric label="Input" value={node.input_gap} />
            <Metric label="Execution" value={node.execution_gap} />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Direct links</h3>
          {model.relationGroups.map((group) => (
            <RelationGroup
              key={group.id}
              group={group}
              selectedNodeId={node.node_id}
              onSelectNodeId={onSelectNodeId}
            />
          ))}
        </section>

        {node.diagnostics.length > 0 ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Diagnostics</h3>
            <ul className={styles.diagnostics}>
              {node.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.message}-${index}`}>{diagnostic.message}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? `${styles.field} ${styles.wide}` : styles.field}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function RelationGroup({
  group,
  selectedNodeId,
  onSelectNodeId,
}: {
  group: SpecRelationGroup;
  selectedNodeId: string;
  onSelectNodeId?: (nodeId: string) => void;
}) {
  return (
    <div className={styles.relationGroup}>
      <span className={styles.relationLabel}>{group.label}</span>
      {group.items.length === 0 ? (
        <span className={styles.empty}>None declared</span>
      ) : (
        <div className={styles.relationList}>
          {group.items.map((item) => (
            <RelationButton
              key={`${group.id}-${item.nodeId}`}
              item={item}
              selectedNodeId={selectedNodeId}
              onSelectNodeId={onSelectNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RelationButton({
  item,
  selectedNodeId,
  onSelectNodeId,
}: {
  item: SpecRelation;
  selectedNodeId: string;
  onSelectNodeId?: (nodeId: string) => void;
}) {
  const canSelect = item.status === "resolved" && item.nodeId !== selectedNodeId;
  const className =
    item.status === "broken"
      ? `${styles.relationButton} ${styles.brokenRelation}`
      : styles.relationButton;

  return (
    <button
      type="button"
      className={className}
      disabled={!canSelect}
      title={item.title ?? "Missing SpecGraph node"}
      onClick={() => onSelectNodeId?.(item.nodeId)}
    >
      {item.nodeId}
    </button>
  );
}
