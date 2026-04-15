import { useState, useEffect, useCallback, useRef } from "react";
import "./SpecNode.css";
import "./SpecInspector.css";

interface SpecInspectorProps {
  selectedNodeId: string | null;
  /** Highlight a sub-item in the inspector. Format: "{subKind}-{index}", e.g. "acceptance-2" */
  selectedSubItemId?: string | null;
  onDismiss?: () => void;
  onFocusNode?: (nodeId: string) => void;
  /** Called when user clicks a sub-item in the inspector; null to deselect. */
  onSelectSubItem?: (subItemId: string | null) => void;
}

// Raw YAML payload from /api/spec-node
type SpecDetail = Record<string, unknown>;

export default function SpecInspector({ selectedNodeId, selectedSubItemId, onDismiss, onFocusNode, onSelectSubItem }: SpecInspectorProps) {
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(440);
  const dragStartRef = useRef<{ x: number; w: number; maxW: number } | null>(null);
  const highlightedItemRef = useRef<HTMLLIElement | null>(null);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : 0;
    const maxW = Math.min(window.innerWidth / 2, window.innerWidth - sidebarRight);
    dragStartRef.current = { x: e.clientX, w: width, maxW };

    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = dragStartRef.current.x - ev.clientX;
      const next = Math.min(Math.max(280, dragStartRef.current.w + delta), dragStartRef.current.maxW);
      setWidth(next);
    };
    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

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

  // Keep CSS variable in sync so minimap can anchor to the inspector's left edge
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--spec-inspector-width", visible ? `${width}px` : "0px");
    return () => root.style.setProperty("--spec-inspector-width", "0px");
  }, [visible, width]);

  // Scroll highlighted sub-item into view.
  // Depends on both selectedSubItemId AND detail so it fires after the async
  // fetch completes and the list items are committed to the DOM.
  useEffect(() => {
    if (!selectedSubItemId || !highlightedItemRef.current) return;
    highlightedItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedSubItemId, detail]);


  const acceptanceRaw = Array.isArray(detail?.acceptance) ? (detail!.acceptance as unknown[]) : [];
  const acceptance = acceptanceRaw.map((item) =>
    typeof item === "string"
      ? { text: item, malformed: false }
      : { text: JSON.stringify(item, null, 2), malformed: true }
  );

  const specSection = (detail?.specification as Record<string, unknown>) ?? {};

  const decisionsRaw = Array.isArray(specSection.decisions) ? (specSection.decisions as unknown[]) : [];
  const decisions = decisionsRaw.map((item) => {
    if (typeof item === "string") return { id: null, statement: item, rationale: null };
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj.id === "string" ? obj.id : null,
        statement: typeof obj.statement === "string" ? obj.statement
          : typeof obj.decision === "string" ? obj.decision
          : JSON.stringify(obj),
        rationale: typeof obj.rationale === "string" ? obj.rationale : null,
      };
    }
    return { id: null, statement: JSON.stringify(item), rationale: null };
  });

  const invariantsRaw = Array.isArray(specSection.invariants) ? (specSection.invariants as unknown[]) : [];
  const invariants = invariantsRaw.map((item) => {
    if (typeof item === "string") return { id: null, statement: item };
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj.id === "string" ? obj.id : null,
        statement: typeof obj.statement === "string" ? obj.statement : JSON.stringify(obj),
      };
    }
    return { id: null, statement: JSON.stringify(item) };
  });

  const evidence = Array.isArray(detail?.acceptance_evidence)
    ? (detail!.acceptance_evidence as Array<Record<string, unknown>>)
    : [];

  // Compute gap sets from available data
  const metCriteria = new Set(
    evidence.map((ev) => String(ev.criterion ?? "").trim()).filter(Boolean),
  );
  const inputs = Array.isArray(detail?.inputs)
    ? (detail!.inputs as unknown[]).map(String)
    : [];
  const executionGap = detail != null && detail.last_outcome == null;

  const hasLinks = [detail?.depends_on, detail?.refines, detail?.relates_to].some(
    (v) => Array.isArray(v) && (v as unknown[]).length > 0,
  );

  const objective = (() => {
    const spec = detail?.specification as Record<string, unknown> | null | undefined;
    const obj = spec?.objective ?? (detail as Record<string, unknown> | null)?.objective;
    return obj ? String(obj) : null;
  })();

  const scope = (() => {
    if (!detail) return null;
    const spec = detail.specification as Record<string, unknown> | null | undefined;
    const raw = (detail.scope ?? spec?.scope) as Record<string, unknown> | null | undefined;
    if (!raw) return null;
    return {
      in: Array.isArray(raw.in) ? (raw.in as unknown[]).map(String) : raw.in ? [String(raw.in)] : [] as string[],
      out: Array.isArray(raw.out) ? (raw.out as unknown[]).map(String) : raw.out ? [String(raw.out)] : [] as string[],
    };
  })();

  return (
    <aside className={`spec-inspector ${visible ? "visible" : ""}`} style={{ width: `${width}px` }}>
      <div className="spec-inspector-resize-handle" onMouseDown={onHandleMouseDown} />
      {onDismiss && (
        <button className="spec-inspector-close" onClick={onDismiss} aria-label="Close inspector">
          ✕
        </button>
      )}

      {loading && <div className="spec-inspector-loading">Loading…</div>}
      {error && <div className="spec-inspector-error">Error: {error}</div>}

      {detail && !loading && (
        <div className="spec-inspector-content">
          {/* 1+2. Header card: title + objective + status + maturity */}
          <div className={`spec-inspector-header-card spec-node status-${str(detail.status)}`}>
            <div
              className={`spec-node-id${onFocusNode ? " node-link" : ""}`}
              onClick={onFocusNode ? () => onFocusNode(str(detail.id)) : undefined}
              title={onFocusNode ? "Focus node on graph" : undefined}
            >{str(detail.id)}</div>
            <h2 className="spec-inspector-main-title">{str(detail.title)}</h2>
            {objective && <p className="spec-inspector-objective">{objective}</p>}
            <div className="spec-node-meta">
              <span className="spec-node-kind-badge">{str(detail.kind)}</span>
              <span className={`spec-node-status-badge status-${str(detail.status)}`}>
                {str(detail.status)}
              </span>
            </div>
            {detail.maturity != null ? (
              <div className="spec-node-maturity">
                <div className="spec-node-maturity-label">
                  Maturity {Math.round((detail.maturity as number) * 100)}%
                </div>
                <div className="spec-node-maturity-track">
                  <div
                    className="spec-node-maturity-fill"
                    style={{ width: `${Math.round((detail.maturity as number) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* 3. Links box */}
          {hasLinks && (
            <div className="spec-inspector-box">
              <FieldList label="depends_on" value={detail.depends_on} onNodeClick={onFocusNode} inline />
              <FieldList label="refines" value={detail.refines} onNodeClick={onFocusNode} inline />
              <FieldList label="relates_to" value={detail.relates_to} onNodeClick={onFocusNode} inline />
            </div>
          )}

          {/* 4. Scope box */}
          {scope && (scope.in.length > 0 || scope.out.length > 0) ? (
            <div className="spec-inspector-box">
              <div className="spec-inspector-box-label">Scope</div>
              {scope.in.length > 0 && (
                <div className="spec-inspector-scope-group">
                  <div className="spec-inspector-scope-label scope-in">In scope</div>
                  <ul className="spec-inspector-scope-list">
                    {scope.in.map((item, i) => {
                      const subId = `scope_in-${i}`;
                      const isHighlighted = selectedSubItemId === subId;
                      return (
                        <li
                          key={i}
                          ref={isHighlighted ? highlightedItemRef : null}
                          className={`selectable${isHighlighted ? " sub-item-highlighted" : ""}`}
                          onClick={() => onSelectSubItem?.(isHighlighted ? null : subId)}
                        >
                          {item}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {scope.out.length > 0 && (
                <div className="spec-inspector-scope-group">
                  <div className="spec-inspector-scope-label scope-out">Out of scope</div>
                  <ul className="spec-inspector-scope-list">
                    {scope.out.map((item, i) => {
                      const subId = `scope_out-${i}`;
                      const isHighlighted = selectedSubItemId === subId;
                      return (
                        <li
                          key={i}
                          ref={isHighlighted ? highlightedItemRef : null}
                          className={`selectable${isHighlighted ? " sub-item-highlighted" : ""}`}
                          onClick={() => onSelectSubItem?.(isHighlighted ? null : subId)}
                        >
                          {item}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {/* 5. Acceptance box */}
          {acceptance.length > 0 && (
            <div className="spec-inspector-box">
              <div className="spec-inspector-box-label">Acceptance</div>
              <ol className="spec-inspector-list">
                {acceptance.map(({ text, malformed }, i) => {
                  const unmet = !malformed && evidence.length > 0 && !metCriteria.has(text.trim());
                  const id = `acceptance-${i}`;
                  const isHighlighted = selectedSubItemId === id;
                  return (
                    <li
                      key={i}
                      ref={isHighlighted ? highlightedItemRef : null}
                      className={`spec-inspector-list-item selectable${unmet ? " gap-unmet" : ""}${malformed ? " format-error" : ""}${isHighlighted ? " sub-item-highlighted" : ""}`}
                      onClick={() => onSelectSubItem?.(isHighlighted ? null : id)}
                    >
                      {unmet && <span className="gap-dot" title="No evidence">●</span>}
                      {malformed
                        ? <MalformedBadge raw={text} />
                        : text}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* 6. Evidence — collapsible box */}
          {evidence.length > 0 && (
            <EvidenceSection evidence={evidence} />
          )}

          {/* 7. Decisions */}
          {decisions.length > 0 && (
            <div className="spec-inspector-box">
              <div className="spec-inspector-box-label">Decisions</div>
              <ol className="spec-inspector-list">
                {decisions.map(({ id, statement, rationale }, i) => {
                  const subId = `decision-${i}`;
                  const isHighlighted = selectedSubItemId === subId;
                  return (
                    <li
                      key={i}
                      ref={isHighlighted ? highlightedItemRef : null}
                      className={`spec-inspector-list-item selectable${isHighlighted ? " sub-item-highlighted" : ""}`}
                      onClick={() => onSelectSubItem?.(isHighlighted ? null : subId)}
                    >
                      {id && <span className="spec-inspector-sub-id">{id}</span>}
                      {statement}
                      {rationale && (
                        <div className="spec-inspector-sub-rationale">{rationale}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* 8. Invariants */}
          {invariants.length > 0 && (
            <div className="spec-inspector-box">
              <div className="spec-inspector-box-label">Invariants</div>
              <ol className="spec-inspector-list">
                {invariants.map(({ id, statement }, i) => {
                  const subId = `invariant-${i}`;
                  const isHighlighted = selectedSubItemId === subId;
                  return (
                    <li
                      key={i}
                      ref={isHighlighted ? highlightedItemRef : null}
                      className={`spec-inspector-list-item selectable${isHighlighted ? " sub-item-highlighted" : ""}`}
                      onClick={() => onSelectSubItem?.(isHighlighted ? null : subId)}
                    >
                      {id && <span className="spec-inspector-sub-id">{id}</span>}
                      {statement}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* — secondary — */}
          {inputs.length > 0 ? (
            <section>
              <div className="spec-inspector-section">inputs</div>
              <ul className="spec-inspector-tags">
                {inputs.map((inp) => {
                  const isRaw = !inp.includes("nodes/");
                  const nodeId = !isRaw ? extractNodeId(inp) : null;
                  return (
                    <li
                      key={inp}
                      className={`spec-inspector-tag${isRaw ? " gap-input" : ""}${nodeId && onFocusNode ? " node-link" : ""}`}
                      onClick={nodeId && onFocusNode ? () => onFocusNode(nodeId) : undefined}
                      title={nodeId ? `Focus ${nodeId} on graph` : undefined}
                    >
                      {inp}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <FieldList label="outputs" value={detail.outputs} onNodeClick={onFocusNode} />

          {detail.prompt ? (
            <section>
              <div className="spec-inspector-section">Prompt</div>
              <pre className="spec-inspector-pre">{str(detail.prompt)}</pre>
            </section>
          ) : null}

          <section>
            <div className="spec-inspector-section">Runtime</div>
            <table className="spec-inspector-table">
              <tbody>
                <Row k="last_outcome" v={detail.last_outcome} gap={executionGap} />
                <Row k="last_blocker" v={detail.last_blocker} />
                <Row k="last_run_at" v={detail.last_run_at} />
                <Row k="gate_state" v={detail.gate_state} />
                <Row k="proposed_status" v={detail.proposed_status} />
                <Row k="required_human_action" v={detail.required_human_action} />
              </tbody>
            </table>
          </section>

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

function MalformedBadge({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <span className="malformed-field">
      <span
        className="malformed-badge"
        onClick={() => setExpanded((v) => !v)}
        title="Malformed field — click to inspect"
      >FORMAT ERROR</span>
      {expanded && <pre className="malformed-raw">{raw}</pre>}
    </span>
  );
}

function str(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}

/** Strip path prefix and extension to get bare node ID (e.g. "specs/nodes/SG-SPEC-0002.yaml" → "SG-SPEC-0002") */
function extractNodeId(item: string): string {
  return item.replace(/^.*nodes\//, "").replace(/\.[^.]+$/, "");
}

function FieldList({ label, value, onNodeClick, inline }: { label: string; value: unknown; onNodeClick?: (id: string) => void; inline?: boolean }) {
  const rawItems = Array.isArray(value) ? (value as unknown[]) : [];
  if (rawItems.length === 0) return null;
  const tags = (
    <>
      <div className={inline ? "spec-inspector-box-label" : "spec-inspector-section"}>{label}</div>
      <ul className="spec-inspector-tags">
        {rawItems.map((raw, i) => {
          if (typeof raw !== "string") {
            return (
              <li key={i} className="spec-inspector-tag format-error">
                <MalformedBadge raw={JSON.stringify(raw, null, 2)} />
              </li>
            );
          }
          const item = raw;
          const nodeId = extractNodeId(item);
          const clickable = Boolean(onNodeClick);
          return (
            <li
              key={item}
              className={`spec-inspector-tag${clickable ? " node-link" : ""}`}
              onClick={clickable ? () => onNodeClick!(nodeId) : undefined}
              title={clickable ? `Focus ${nodeId} on graph` : undefined}
            >
              {item}
            </li>
          );
        })}
      </ul>
    </>
  );
  return inline ? <div className="spec-inspector-field-group">{tags}</div> : <section>{tags}</section>;
}

function EvidenceSection({ evidence }: { evidence: Array<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`spec-inspector-box spec-inspector-box-collapsible${open ? " open" : ""}`}>
      <button className="spec-inspector-box-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="spec-inspector-box-label">Evidence ({evidence.length})</span>
        <span className="spec-inspector-toggle-icon">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="spec-inspector-evidence-list">
          {evidence.map((ev, i) => (
            <div key={i} className="spec-inspector-evidence-item">
              <div className="spec-inspector-evidence-criterion">{str(ev.criterion)}</div>
              {Boolean(ev.evidence) && (
                <div className="spec-inspector-evidence-text">{str(ev.evidence)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, gap }: { k: string; v: unknown; gap?: boolean }) {
  const isNull = v == null;
  if (isNull && !gap) return null;
  return (
    <tr className={gap ? "gap-row" : undefined}>
      <td className="spec-inspector-table-key">{k}</td>
      <td className={`spec-inspector-table-val${gap ? " gap-null" : ""}`}>
        {isNull ? "—" : String(v)}
      </td>
    </tr>
  );
}
