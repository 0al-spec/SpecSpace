import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./SpecNode.css";
import "./SpecInspector.css";
import "./PanelBtn.css";
import PanelActions from "./PanelActions";
import PanelBtn from "./PanelBtn";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleDot, faCalendarPlus, faRotate, faBoxArchive, faThumbtack, faMagnifyingGlassChart } from "@fortawesome/free-solid-svg-icons";
import type { ApiSpecGraph, ApiSpecNode } from "./types";
import { renderInlineText } from "./renderInlineText";

interface SpecInspectorProps {
  selectedNodeId: string | null;
  /** Highlight a sub-item in the inspector. Format: "{subKind}-{index}", e.g. "acceptance-2" */
  selectedSubItemId?: string | null;
  onDismiss?: () => void;
  onFocusNode?: (nodeId: string) => void;
  /** Called when user clicks a sub-item in the inspector; null to deselect. */
  onSelectSubItem?: (subItemId: string | null) => void;
  /** Open the force-directed lens for the selected node */
  onOpenLens?: (nodeId: string) => void;
  /** Open the SpecPM export preview overlay. Undefined → button hidden. */
  onOpenSpecpmPreview?: () => void;
  /** Open the exploration/proposals surface. Undefined → button hidden. */
  onOpenExplorationPreview?: () => void;
  /** Full spec graph — used to resolve peer node titles/statuses in Related section */
  rawGraph?: ApiSpecGraph | null;
  /** Pinned node ID for compare mode */
  pinnedNodeId?: string | null;
  /** Set/clear pinned node */
  onPin?: (id: string | null) => void;
  /** Navigation history controls */
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  backLabel?: string;
  forwardLabel?: string;
}

// Raw YAML payload from /api/spec-node
type SpecDetail = Record<string, unknown>;

export default function SpecInspector({
  selectedNodeId, selectedSubItemId,
  onDismiss, onFocusNode, onSelectSubItem, onOpenLens, onOpenSpecpmPreview, onOpenExplorationPreview,
  rawGraph, pinnedNodeId, onPin,
  canGoBack, canGoForward, onBack, onForward, backLabel, forwardLabel,
}: SpecInspectorProps) {
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(440);
  const [pinnedDetail, setPinnedDetail] = useState<SpecDetail | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const dragStartRef = useRef<{ x: number; w: number; maxW: number } | null>(null);
  const singleWidthRef = useRef<number | null>(null);

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

  // Fetch pinned spec detail
  useEffect(() => {
    if (!pinnedNodeId) { setPinnedDetail(null); return; }
    setPinnedLoading(true);
    fetch(`/api/spec-node?id=${encodeURIComponent(pinnedNodeId)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { setPinnedDetail(data.data ?? data.node ?? data); setPinnedLoading(false); })
      .catch(() => setPinnedLoading(false));
  }, [pinnedNodeId]);

  // isPinned: true as soon as the user pins (before pinnedDetail loads)
  const isPinned = Boolean(pinnedNodeId && pinnedNodeId !== selectedNodeId);
  // compareMode: only true once pinnedDetail is ready
  const compareMode = isPinned && Boolean(pinnedDetail) && !pinnedLoading;

  // Save single-pane width before expanding; restore when compare exits
  useEffect(() => {
    if (compareMode) {
      setWidth((w) => { singleWidthRef.current = w; return Math.max(w, 880); });
    } else if (singleWidthRef.current !== null) {
      setWidth(singleWidthRef.current);
      singleWidthRef.current = null;
    }
  }, [compareMode]);

  const visible = Boolean(selectedNodeId);

  // Build a fast lookup map from rawGraph so RelatedItemsSection can resolve peer metadata
  const nodeById = useMemo(() => {
    const map = new Map<string, ApiSpecNode>();
    for (const n of rawGraph?.nodes ?? []) map.set(n.node_id, n);
    return map;
  }, [rawGraph]);

  // Keep CSS variable in sync so filter bar / minimap can anchor to the inspector's left edge
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--spec-inspector-width", visible ? `${width}px` : "0px");
    return () => root.style.setProperty("--spec-inspector-width", "0px");
  }, [visible, width]);

  return (
    <aside
      className={`spec-inspector ${visible ? "visible" : ""} ${compareMode ? "compare-mode" : ""}`}
      style={{ width: `${width}px` }}
    >
      <div className="spec-inspector-resize-handle" onMouseDown={onHandleMouseDown} />
      <PanelActions
        className="spec-inspector-actions"
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={onBack}
        onForward={onForward}
        backLabel={backLabel}
        forwardLabel={forwardLabel}
        extra={[
          ...(onPin && selectedNodeId ? [{
            icon: <FontAwesomeIcon icon={faThumbtack} />,
            title: isPinned ? "Unpin comparison" : "Pin to compare",
            onClick: () => onPin(isPinned ? null : selectedNodeId),
            className: isPinned ? "panel-btn-pin-active" : undefined,
          }] : []),
        ]}
        onClose={onDismiss}
      />

      {loading && <div className="spec-inspector-loading">Loading…</div>}
      {error && <div className="spec-inspector-error">Error: {error}</div>}

      {compareMode && pinnedDetail && detail && !loading ? (
        <div className="spec-inspector-panes">
          {/* Current spec — LEFT */}
          <div className="spec-inspector-pane spec-inspector-pane--current">
            <SpecDetailPane
              detail={detail}
              nodeById={nodeById}
              onFocusNode={onFocusNode}
              selectedSubItemId={selectedSubItemId}
              onSelectSubItem={onSelectSubItem}
              paneRole="current"
              onOpenLens={onOpenLens && selectedNodeId ? () => onOpenLens!(selectedNodeId!) : undefined}
              onOpenSpecpmPreview={onOpenSpecpmPreview}
              onOpenExplorationPreview={onOpenExplorationPreview}
            />
          </div>
          {/* Pinned spec — RIGHT */}
          <div className="spec-inspector-pane spec-inspector-pane--pinned">
            <SpecDetailPane
              detail={pinnedDetail}
              nodeById={nodeById}
              onFocusNode={onFocusNode}
              paneRole="pinned"
              onUnpin={() => onPin?.(null)}
              onOpenLens={onOpenLens && pinnedNodeId ? () => onOpenLens!(pinnedNodeId!) : undefined}
            />
          </div>
        </div>
      ) : detail && !loading && (
        <SpecDetailPane
          detail={detail}
          nodeById={nodeById}
          onFocusNode={onFocusNode}
          selectedSubItemId={selectedSubItemId}
          onSelectSubItem={onSelectSubItem}
          onOpenLens={onOpenLens && selectedNodeId ? () => onOpenLens!(selectedNodeId!) : undefined}
          onOpenSpecpmPreview={onOpenSpecpmPreview}
          onOpenExplorationPreview={onOpenExplorationPreview}
        />
      )}
    </aside>
  );
}

// ── SpecDetailPane — full spec content, used in both single and compare mode ──

interface SpecDetailPaneProps {
  detail: SpecDetail;
  nodeById: Map<string, ApiSpecNode>;
  onFocusNode?: (id: string) => void;
  selectedSubItemId?: string | null;
  onSelectSubItem?: (id: string | null) => void;
  /** Role badge shown inline next to the node ID */
  paneRole?: "pinned" | "current";
  /** Unpin handler — rendered as small inline button when paneRole === "pinned" */
  onUnpin?: () => void;
  /** Open SpecLens for this spec (no nodeId arg — caller captures it) */
  onOpenLens?: () => void;
  /** Open SpecPM export preview */
  onOpenSpecpmPreview?: () => void;
  /** Open exploration/proposals surface */
  onOpenExplorationPreview?: () => void;
}

function SpecDetailPane({
  detail, nodeById, onFocusNode, selectedSubItemId, onSelectSubItem,
  paneRole, onUnpin, onOpenLens, onOpenSpecpmPreview, onOpenExplorationPreview,
}: SpecDetailPaneProps) {
  const hlRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!selectedSubItemId || !hlRef.current) return;
    hlRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedSubItemId, detail]);

  // ── data preparation ──────────────────────────────────────────────────────

  const acceptanceRaw = Array.isArray(detail.acceptance) ? (detail.acceptance as unknown[]) : [];
  const acceptance = acceptanceRaw.map((item) =>
    typeof item === "string"
      ? { text: item, malformed: false }
      : { text: JSON.stringify(item, null, 2), malformed: true }
  );

  const specSection = (detail.specification as Record<string, unknown>) ?? {};

  const decisionsRaw = Array.isArray(specSection.decisions) ? (specSection.decisions as unknown[]) : [];
  const decisions = decisionsRaw.map((item) => {
    if (typeof item === "string") return { id: null, statement: item, rationale: null };
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj.id === "string" ? obj.id : null,
        statement: typeof obj.statement === "string" ? obj.statement
          : typeof obj.decision === "string" ? obj.decision : JSON.stringify(obj),
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

  const evidence = Array.isArray(detail.acceptance_evidence)
    ? (detail.acceptance_evidence as Array<Record<string, unknown>>) : [];
  const metCriteria = new Set(evidence.map((ev) => String(ev.criterion ?? "").trim()).filter(Boolean));
  const inputs = Array.isArray(detail.inputs) ? (detail.inputs as unknown[]).map(String) : [];
  const executionGap = detail.last_outcome == null;

  const hasLinks = [detail.depends_on, detail.refines, detail.relates_to].some(
    (v) => Array.isArray(v) && (v as unknown[]).length > 0,
  );

  const objective = (() => {
    const spec = detail.specification as Record<string, unknown> | null | undefined;
    const obj = spec?.objective ?? (detail as Record<string, unknown>).objective;
    return obj ? String(obj) : null;
  })();

  const scope = (() => {
    const spec = detail.specification as Record<string, unknown> | null | undefined;
    const raw = (detail.scope ?? spec?.scope) as Record<string, unknown> | null | undefined;
    if (!raw) return null;
    return {
      in: Array.isArray(raw.in) ? (raw.in as unknown[]).map(String) : raw.in ? [String(raw.in)] : [] as string[],
      out: Array.isArray(raw.out) ? (raw.out as unknown[]).map(String) : raw.out ? [String(raw.out)] : [] as string[],
    };
  })();

  const hasDates = detail.created_at != null || detail.updated_at != null;
  const hasCardActions = Boolean(onOpenLens || onOpenSpecpmPreview || onOpenExplorationPreview);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="spec-inspector-content">
      {/* 1. Header card */}
      <div className={`spec-inspector-header-card spec-node status-${str(detail.status)}`}>

        {/* ID row: node ID + role badge + unpin button */}
        <div className="spec-inspector-id-row">
          <div
            className={`spec-node-id${onFocusNode ? " node-link" : ""}`}
            onClick={onFocusNode ? () => onFocusNode(str(detail.id)) : undefined}
            title={onFocusNode ? "Focus node on graph" : undefined}
          >{str(detail.id)}</div>
          {paneRole === "pinned" && (
            <span className="spec-inspector-role-badge spec-inspector-role-badge--pinned">
              <FontAwesomeIcon icon={faThumbtack} className="spec-inspector-role-pin-icon" />
              {" "}Pinned
            </span>
          )}
          {paneRole === "current" && (
            <span className="spec-inspector-role-badge spec-inspector-role-badge--current">Current</span>
          )}
          {paneRole === "pinned" && onUnpin && (
            <button className="spec-inspector-unpin-btn" onClick={onUnpin}>Unpin</button>
          )}
        </div>

        <h2 className="spec-inspector-main-title">{str(detail.title)}</h2>
        {objective && <p className="spec-inspector-objective">{renderInlineText(objective)}</p>}
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

        {/* Footer: dates (left) + action buttons (right) */}
        {(hasDates || hasCardActions) && (
          <div className="spec-inspector-card-footer">
            <div className="spec-inspector-dates">
              {detail.created_at != null && (
                <span title={str(detail.created_at)}>
                  <span className="spec-inspector-dates-icon"><FontAwesomeIcon icon={faCalendarPlus} /></span>
                  {fmtDate(detail.created_at)}
                </span>
              )}
              {detail.updated_at != null && (
                <span title={str(detail.updated_at)}>
                  <span className="spec-inspector-dates-icon"><FontAwesomeIcon icon={faRotate} /></span>
                  {fmtDate(detail.updated_at)}
                </span>
              )}
            </div>
            {hasCardActions && (
              <div className="spec-inspector-card-actions">
                {onOpenLens && (
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faCircleDot} />}
                    title="Open SpecLens"
                    onClick={onOpenLens}
                    className="panel-btn-lens"
                  />
                )}
                {onOpenSpecpmPreview && (
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faBoxArchive} />}
                    title="Preview for SpecPM"
                    onClick={onOpenSpecpmPreview}
                  />
                )}
                {onOpenExplorationPreview && (
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faMagnifyingGlassChart} />}
                    title="Exploration / Proposals"
                    onClick={onOpenExplorationPreview}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Related items drawer */}
      {hasLinks && (
        <RelatedItemsSection
          dependsOn={arr(detail.depends_on)}
          refines={arr(detail.refines)}
          relatesTo={arr(detail.relates_to)}
          nodeById={nodeById}
          onFocusNode={onFocusNode}
        />
      )}

      {/* 3. Scope box */}
      {scope && (scope.in.length > 0 || scope.out.length > 0) ? (
        <div className="spec-inspector-box">
          <div className="spec-inspector-box-label">Scope</div>
          {scope.in.length > 0 && (
            <div className="spec-inspector-scope-group">
              <div className="spec-inspector-scope-label scope-in">In scope</div>
              <ul className="spec-inspector-scope-list">
                {scope.in.map((item, i) => {
                  const subId = `scope_in-${i}`;
                  const isHl = selectedSubItemId === subId;
                  return (
                    <li
                      key={i}
                      ref={isHl ? hlRef : null}
                      className={`selectable${isHl ? " sub-item-highlighted" : ""}`}
                      onClick={() => onSelectSubItem?.(isHl ? null : subId)}
                    >{renderInlineText(item)}</li>
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
                  const isHl = selectedSubItemId === subId;
                  return (
                    <li
                      key={i}
                      ref={isHl ? hlRef : null}
                      className={`selectable${isHl ? " sub-item-highlighted" : ""}`}
                      onClick={() => onSelectSubItem?.(isHl ? null : subId)}
                    >{renderInlineText(item)}</li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* 4. Acceptance box */}
      {acceptance.length > 0 && (
        <div className="spec-inspector-box">
          <div className="spec-inspector-box-label">Acceptance</div>
          <ol className="spec-inspector-list">
            {acceptance.map(({ text, malformed }, i) => {
              const unmet = !malformed && evidence.length > 0 && !metCriteria.has(text.trim());
              const id = `acceptance-${i}`;
              const isHl = selectedSubItemId === id;
              return (
                <li
                  key={i}
                  ref={isHl ? hlRef : null}
                  className={`spec-inspector-list-item selectable${unmet ? " gap-unmet" : ""}${malformed ? " format-error" : ""}${isHl ? " sub-item-highlighted" : ""}`}
                  onClick={() => onSelectSubItem?.(isHl ? null : id)}
                >
                  {unmet && <span className="gap-dot" title="No evidence">●</span>}
                  {malformed ? <MalformedBadge raw={text} /> : renderInlineText(text)}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 5. Evidence — collapsible box */}
      {evidence.length > 0 && <EvidenceSection evidence={evidence} />}

      {/* 6. Decisions */}
      {decisions.length > 0 && (
        <div className="spec-inspector-box">
          <div className="spec-inspector-box-label">Decisions</div>
          <ol className="spec-inspector-list">
            {decisions.map(({ id, statement, rationale }, i) => {
              const subId = `decision-${i}`;
              const isHl = selectedSubItemId === subId;
              return (
                <li
                  key={i}
                  ref={isHl ? hlRef : null}
                  className={`spec-inspector-list-item selectable${isHl ? " sub-item-highlighted" : ""}`}
                  onClick={() => onSelectSubItem?.(isHl ? null : subId)}
                >
                  {id && <span className="spec-inspector-sub-id">{id}</span>}
                  {renderInlineText(statement)}
                  {rationale && <div className="spec-inspector-sub-rationale">{renderInlineText(rationale)}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 7. Invariants */}
      {invariants.length > 0 && (
        <div className="spec-inspector-box">
          <div className="spec-inspector-box-label">Invariants</div>
          <ol className="spec-inspector-list">
            {invariants.map(({ id, statement }, i) => {
              const subId = `invariant-${i}`;
              const isHl = selectedSubItemId === subId;
              return (
                <li
                  key={i}
                  ref={isHl ? hlRef : null}
                  className={`spec-inspector-list-item selectable${isHl ? " sub-item-highlighted" : ""}`}
                  onClick={() => onSelectSubItem?.(isHl ? null : subId)}
                >
                  {id && <span className="spec-inspector-sub-id">{id}</span>}
                  {renderInlineText(statement)}
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

/** Format an ISO-8601 timestamp to a short human date, e.g. "3 Apr 2026". */
function fmtDate(v: unknown): string {
  if (v == null) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Strip path prefix and extension to get bare node ID (e.g. "specs/nodes/SG-SPEC-0002.yaml" → "SG-SPEC-0002") */
function extractNodeId(item: string): string {
  return item.replace(/^.*nodes\//, "").replace(/\.[^.]+$/, "");
}

/** Cast unknown to string[] safely */
function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x) => typeof x === "string") as string[] : [];
}

const EDGE_KIND_LABELS: Record<string, string> = {
  depends_on: "Depends on",
  refines: "Refines",
  relates_to: "Relates to",
};

interface RelatedItemsSectionProps {
  dependsOn: string[];
  refines: string[];
  relatesTo: string[];
  nodeById: Map<string, ApiSpecNode>;
  onFocusNode?: (id: string) => void;
}

function RelatedItemsSection({ dependsOn, refines, relatesTo, nodeById, onFocusNode }: RelatedItemsSectionProps) {
  const groups: { kind: string; ids: string[] }[] = [
    { kind: "depends_on", ids: dependsOn },
    { kind: "refines",    ids: refines },
    { kind: "relates_to", ids: relatesTo },
  ].filter((g) => g.ids.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="spec-inspector-box related-items-box">
      <div className="spec-inspector-box-label">Related</div>
      {groups.map((group, gi) => (
        <div key={group.kind} className={`related-items-group${gi > 0 ? " related-items-group--sep" : ""}`}>
          <div className="related-items-kind-label">{EDGE_KIND_LABELS[group.kind]}</div>
          <ul className="related-items-list">
            {group.ids.map((raw) => {
              const nodeId = extractNodeId(raw);
              const peer = nodeById.get(nodeId);
              return (
                <li
                  key={raw}
                  className={`related-item${onFocusNode ? " related-item--clickable" : ""}`}
                  onClick={onFocusNode ? () => onFocusNode(nodeId) : undefined}
                  title={onFocusNode ? `Focus ${nodeId} on graph` : undefined}
                >
                  <span className="related-item-id">{nodeId}</span>
                  <span className="related-item-title">{peer?.title ?? raw}</span>
                  {peer && (
                    <span className={`spec-node-status-badge status-${peer.status}`}>
                      {peer.status}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
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
