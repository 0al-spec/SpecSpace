import type { HTMLAttributes } from "react";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import { buildSpecEdgeInspectorModel } from "../model/build-spec-edge-inspector-model";
import styles from "./SpecEdgeInspector.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  edge: SpecEdge;
  nodesById: ReadonlyMap<string, SpecNode>;
  resolveSpecRef?: SpecRefResolver;
  onSelectNodeId?: (nodeId: string) => void;
  onAddEdgeToAgentContext?: () => void;
  onClose: () => void;
};

export function SpecEdgeInspector({
  edge,
  nodesById,
  resolveSpecRef,
  onSelectNodeId,
  onAddEdgeToAgentContext,
  onClose,
  className,
  ...rest
}: Props) {
  const model = buildSpecEdgeInspectorModel(edge, nodesById);
  const cls = [styles.panel, className].filter(Boolean).join(" ");

  return (
    <aside className={cls} aria-label="Spec edge inspector" {...rest}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.kicker}>Selected edge</span>
          <span className={styles.edgeKind}>{model.relationLabel}</span>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.scroll}>
        <h2 className={styles.title}>{model.edge.edge_id}</h2>
        <p className={styles.direction}>{model.directionLabel}</p>

        <dl className={styles.metaGrid}>
          <Field label="Kind" value={model.edge.edge_kind} />
          <Field label="Status" value={model.statusLabel} />
          <EndpointField
            label="Source"
            nodeId={model.source.nodeId}
            title={model.source.title}
            missing={model.source.missing}
            resolveSpecRef={resolveSpecRef}
            onSelectNodeId={onSelectNodeId}
          />
          <EndpointField
            label="Target"
            nodeId={model.target.nodeId}
            title={model.target.title}
            missing={model.target.missing}
            resolveSpecRef={resolveSpecRef}
            onSelectNodeId={onSelectNodeId}
          />
        </dl>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Relation</h3>
          <p className={styles.relationText}>
            {model.relationLabel} connects source and target specs according to
            the canonical SpecGraph edge direction.
          </p>
          {model.hasMissingEndpoint ? (
            <p className={styles.warning}>
              This edge references at least one endpoint that is not present in
              the current graph payload.
            </p>
          ) : null}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Agent context</h3>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onAddEdgeToAgentContext}
            disabled={!onAddEdgeToAgentContext}
          >
            Add Selected Edge
          </button>
        </section>
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EndpointField({
  label,
  nodeId,
  title,
  missing,
  resolveSpecRef,
  onSelectNodeId,
}: {
  label: string;
  nodeId: string;
  title: string | null;
  missing: boolean;
  resolveSpecRef?: SpecRefResolver;
  onSelectNodeId?: (nodeId: string) => void;
}) {
  return (
    <div className={`${styles.field} ${styles.wide}`}>
      <dt>{label}</dt>
      <dd>
        <SpecIdText
          text={nodeId}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={missing ? undefined : onSelectNodeId}
          variant="bare"
          specClassName={styles.nodeId}
        />
        <span className={styles.endpointTitle}>
          {missing ? "Missing endpoint" : title}
        </span>
      </dd>
    </div>
  );
}
