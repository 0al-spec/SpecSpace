import { useState, type HTMLAttributes, type ReactNode } from "react";
import { getSpecNodeStatusTone } from "@/entities/spec-node";
import {
  buildSpecInspectorModel,
  useSpecNodeDetail,
  type SpecInspectorDetailModel,
  type SpecInspectorSelection,
  type SpecRelationGroup,
  type SpecRelation,
  type UseSpecNodeDetailState,
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
  const detailState = useSpecNodeDetail({ nodeId: selection.node.node_id });
  const detail =
    detailState.kind === "ok" ? detailState.data.data : null;
  const model = buildSpecInspectorModel(selection, detail);
  const { node } = model;
  const statusTone = getSpecNodeStatusTone(node.status);
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
          <span className={`${styles.status} ${styles[`status-${statusTone}`]}`}>
            {node.status}
          </span>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.scroll}>
        <h2 className={styles.title}>{node.title}</h2>
        {model.detail?.objective ? (
          <p className={styles.objective}>{model.detail.objective}</p>
        ) : null}

        <dl className={styles.metaGrid}>
          <Field label="Kind" value={node.kind} />
          <Field label="Maturity" value={model.maturityLabel} />
          <Field label="Acceptance" value={String(node.acceptance_count)} />
          <Field label="Decisions" value={String(node.decisions_count)} />
          <Field label="Gaps" value={String(node.gap_count)} wide />
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
            <dd className={styles.fileValue} title={model.filePath}>
              {node.file_name}
            </dd>
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

        <DetailLoadStatus state={detailState} />

        {model.detail ? <RichSpecDetail detail={model.detail} /> : null}

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

function DetailLoadStatus({ state }: { state: UseSpecNodeDetailState }) {
  const message = describeDetailState(state);
  return message ? <div className={styles.detailStatus}>{message}</div> : null;
}

function describeDetailState(state: UseSpecNodeDetailState): string | null {
  switch (state.kind) {
    case "idle":
    case "loading":
      return "Loading detailed spec content...";
    case "ok":
      return null;
    case "http-error":
      return `Detailed spec content unavailable: HTTP ${state.status}`;
    case "network-error":
      return `Detailed spec content unavailable: ${state.message}`;
    case "response-error":
      return `Detailed spec content unavailable: ${state.reason}`;
    case "parse-error":
      return "Detailed spec content unavailable: response did not match the contract";
    case "invariant-violation":
      return `Detailed spec content unavailable: ${state.message}`;
    case "version-not-supported":
      return `Detailed spec content unavailable: schema v${state.schema_version} is not supported`;
    case "wrong-artifact-kind":
      return "Detailed spec content unavailable: wrong artifact kind";
  }
  return null;
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

function RichSpecDetail({ detail }: { detail: SpecInspectorDetailModel }) {
  const hasScope = Boolean(detail.scope);
  const hasFlow =
    detail.inputs.length > 0 ||
    detail.outputs.length > 0 ||
    detail.allowedPaths.length > 0;
  const hasLifecycle = Boolean(detail.createdAt || detail.updatedAt);
  const hasRuntime = hasLifecycle || detail.runtime.length > 0;

  return (
    <>
      {hasScope ? <ScopeSection scope={detail.scope!} /> : null}

      {detail.acceptance.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Acceptance</h3>
          <ol className={styles.contentList}>
            {detail.acceptance.map((item, index) => (
              <li key={`${item.text}-${index}`} className={styles.contentItem}>
                <span
                  className={
                    item.hasEvidence ? styles.evidenceBadge : styles.gapBadge
                  }
                >
                  {item.hasEvidence ? "evidence" : "gap"}
                </span>
                <span className={styles.contentText}>{item.text}</span>
                {item.malformed ? (
                  <span className={styles.formatBadge}>format</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {detail.evidence.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Acceptance evidence</h3>
          <div className={styles.evidenceList}>
            {detail.evidence.map((item, index) => (
              <article key={`${item.criterion}-${index}`} className={styles.evidenceItem}>
                <div className={styles.evidenceCriterion}>{item.criterion}</div>
                {item.evidence ? (
                  <p className={styles.evidenceText}>{renderRichInlineText(item.evidence)}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {detail.terminology.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Terminology</h3>
          <dl className={styles.termList}>
            {detail.terminology.map((entry) => (
              <div key={entry.term} className={styles.termItem}>
                <dt>{entry.term}</dt>
                <dd>{renderRichInlineText(entry.definition)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <DecisionSection title="Decisions" items={detail.decisions} />
      <DecisionSection title="Invariants" items={detail.invariants} />

      {hasFlow ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Files and paths</h3>
          <TagList label="Inputs" items={detail.inputs} />
          <TagList label="Outputs" items={detail.outputs} />
          <TagList label="Allowed paths" items={detail.allowedPaths} />
        </section>
      ) : null}

      {hasRuntime ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Lifecycle and runtime</h3>
          <div className={styles.fieldRows}>
            {detail.createdAt ? (
              <KeyValue label="Created" value={formatDate(detail.createdAt)} />
            ) : null}
            {detail.updatedAt ? (
              <KeyValue label="Updated" value={formatDate(detail.updatedAt)} />
            ) : null}
            {detail.runtime.map((field) => (
              <KeyValue key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.prompt ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Prompt</h3>
          <pre className={styles.pre}>{detail.prompt}</pre>
        </section>
      ) : null}

      {detail.rawSpecification ? (
        <details className={styles.rawDisclosure}>
          <summary>Specification raw</summary>
          <pre className={`${styles.pre} ${styles.rawPre}`}>
            {JSON.stringify(detail.rawSpecification, null, 2)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

function ScopeSection({ scope }: { scope: NonNullable<SpecInspectorDetailModel["scope"]> }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Scope</h3>
      <div className={styles.scopeGrid}>
        {scope.in.length > 0 ? (
          <div className={styles.scopeBlock}>
            <h4>In scope</h4>
            <ul className={styles.contentList}>
              {scope.in.map((item) => (
                <li key={item} className={styles.contentItem}>
                  <span className={styles.contentText}>{renderRichInlineText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {scope.out.length > 0 ? (
          <div className={styles.scopeBlock}>
            <h4>Out of scope</h4>
            <ul className={styles.contentList}>
              {scope.out.map((item) => (
                <li key={item} className={styles.contentItem}>
                  <span className={styles.contentText}>{renderRichInlineText(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DecisionSection({
  title,
  items,
}: {
  title: string;
  items: SpecInspectorDetailModel["decisions"];
}) {
  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <ul className={`${styles.contentList} ${styles.decisionList}`}>
        {items.map((item, index) => (
          <li
            key={`${item.id ?? item.statement}-${index}`}
            className={`${styles.contentItem} ${styles.decisionItem}`}
          >
            {item.id ? <span className={styles.idBadge}>{item.id}</span> : null}
            <span className={styles.contentText}>
              {renderRichInlineText(item.statement)}
            </span>
            {item.rationale ? (
              <p className={styles.rationale}>{renderRichInlineText(item.rationale)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TagList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.tagGroup}>
      <span className={styles.tagLabel}>{label}</span>
      <ul className={styles.tagList}>
        {items.map((item) => (
          <li key={item} className={styles.tag}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fieldRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const inlineTokenPattern =
  /(`[^`]+`|\b(?:SG-)?SPEC-\d{4}\b|\b[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\b)/g;

function renderRichInlineText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlineTokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    const isSpecRef = /\b(?:SG-)?SPEC-\d{4}\b/.test(token);
    const label =
      token.startsWith("`") && token.endsWith("`") ? token.slice(1, -1) : token;
    parts.push(
      <span
        key={`${token}-${index}`}
        className={isSpecRef ? styles.inlineSpecRef : styles.inlineCode}
      >
        {label}
      </span>,
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

const utcDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return utcDateFormatter.format(date);
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
    <details className={styles.relationGroup}>
      <summary className={styles.relationSummary}>
        <span className={styles.relationLabel}>{group.label}</span>
        <span className={styles.relationCount}>{group.items.length}</span>
      </summary>
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
    </details>
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
