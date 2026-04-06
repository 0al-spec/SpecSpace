import { useState, useEffect } from "react";
import "./SpecInspector.css";

interface SpecInspectorProps {
  selectedNodeId: string | null;
  onDismiss: () => void;
}

// Raw YAML payload from /api/spec-node
type SpecDetail = Record<string, unknown>;

export default function SpecInspector({ selectedNodeId, onDismiss }: SpecInspectorProps) {
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNodeId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/spec-node?id=${encodeURIComponent(selectedNodeId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDetail(data.data ?? data.node ?? data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [selectedNodeId]);

  const visible = Boolean(selectedNodeId);

  // Typed accessors to avoid `unknown` leaking into JSX
  const acceptance = Array.isArray(detail?.acceptance)
    ? (detail!.acceptance as string[])
    : [];
  const evidence = Array.isArray(detail?.acceptance_evidence)
    ? (detail!.acceptance_evidence as Array<Record<string, unknown>>)
    : [];

  return (
    <aside className={`spec-inspector ${visible ? "visible" : ""}`}>
      <button className="spec-inspector-close" onClick={onDismiss} title="Close">
        ✕
      </button>

      {loading && <div className="spec-inspector-loading">Loading…</div>}
      {error && <div className="spec-inspector-error">Error: {error}</div>}

      {detail && !loading && (
        <div className="spec-inspector-content">
          {/* Header */}
          <div className="spec-inspector-id">{str(detail.id)}</div>
          <div className="spec-inspector-title">{str(detail.title)}</div>

          <div className="spec-inspector-badges">
            <span className="spec-inspector-badge kind">{str(detail.kind)}</span>
            <span className={`spec-inspector-badge status-${str(detail.status)}`}>
              {str(detail.status)}
            </span>
            {detail.maturity != null && (
              <span className="spec-inspector-badge maturity">
                {Math.round((detail.maturity as number) * 100)}% maturity
              </span>
            )}
          </div>

          {/* Edge lists */}
          <FieldList label="depends_on" value={detail.depends_on} />
          <FieldList label="refines" value={detail.refines} />
          <FieldList label="relates_to" value={detail.relates_to} />

          {/* Acceptance criteria */}
          {acceptance.length > 0 && (
            <section>
              <div className="spec-inspector-section">Acceptance</div>
              <ol className="spec-inspector-list">
                {acceptance.map((c, i) => (
                  <li key={i} className="spec-inspector-list-item">{String(c)}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Evidence */}
          {evidence.length > 0 ? (
            <section>
              <div className="spec-inspector-section">Evidence</div>
              {evidence.map((ev, i) => (
                <div key={i} className="spec-inspector-evidence">
                  <div className="spec-inspector-evidence-criterion">{str(ev.criterion)}</div>
                  {Boolean(ev.evidence) ? (
                    <div className="spec-inspector-evidence-text">{str(ev.evidence)}</div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {/* Inputs / Outputs */}
          <FieldList label="inputs" value={detail.inputs} />
          <FieldList label="outputs" value={detail.outputs} />

          {/* Prompt */}
          {detail.prompt ? (
            <section>
              <div className="spec-inspector-section">Prompt</div>
              <pre className="spec-inspector-pre">{str(detail.prompt)}</pre>
            </section>
          ) : null}

          {/* Runtime state */}
          <section>
            <div className="spec-inspector-section">Runtime</div>
            <table className="spec-inspector-table">
              <tbody>
                <Row k="last_outcome" v={detail.last_outcome} />
                <Row k="last_blocker" v={detail.last_blocker} />
                <Row k="last_run_at" v={detail.last_run_at} />
                <Row k="gate_state" v={detail.gate_state} />
                <Row k="proposed_status" v={detail.proposed_status} />
                <Row k="required_human_action" v={detail.required_human_action} />
              </tbody>
            </table>
          </section>

          {/* Raw specification block — dump as JSON for now */}
          {detail.specification ? (
            <section>
              <div className="spec-inspector-section">Specification (raw)</div>
              <pre className="spec-inspector-pre spec-inspector-raw">
                {JSON.stringify(detail.specification, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}

function FieldList({ label, value }: { label: string; value: unknown }) {
  const items = Array.isArray(value) ? (value as unknown[]).map(String).filter(Boolean) : [];
  if (items.length === 0) return null;
  return (
    <section>
      <div className="spec-inspector-section">{label}</div>
      <ul className="spec-inspector-tags">
        {items.map((item) => (
          <li key={item} className="spec-inspector-tag">{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  if (v == null) return null;
  return (
    <tr>
      <td className="spec-inspector-table-key">{k}</td>
      <td className="spec-inspector-table-val">{String(v)}</td>
    </tr>
  );
}
