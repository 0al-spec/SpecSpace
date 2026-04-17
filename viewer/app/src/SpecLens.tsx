/**
 * SpecLens — floating document view of a spec node.
 *
 * Opened via the ⊙ button in the SpecInspector header.
 * Shows the full specification content (objective, AC, decisions,
 * invariants, scope, links) in a draggable, resizable panel.
 */
import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import "./SpecLens.css";

// ─── Raw API shape ────────────────────────────────────────────────────────────

type SpecDetail = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

interface Decision { id: string | null; statement: string; rationale: string | null }
interface Invariant { id: string | null; statement: string }
interface ScopeData  { in: string[]; out: string[] }

function parseDecisions(detail: SpecDetail): Decision[] {
  const spec = (detail.specification as Record<string, unknown>) ?? {};
  const raw = Array.isArray(spec.decisions) ? (spec.decisions as unknown[]) : [];
  return raw.map((item) => {
    if (typeof item === "string") return { id: null, statement: item, rationale: null };
    const obj = item as Record<string, unknown>;
    return {
      id:        typeof obj.id        === "string" ? obj.id        : null,
      statement: typeof obj.statement === "string" ? obj.statement
               : typeof obj.decision  === "string" ? obj.decision  : JSON.stringify(obj),
      rationale: typeof obj.rationale === "string" ? obj.rationale : null,
    };
  });
}

function parseInvariants(detail: SpecDetail): Invariant[] {
  const spec = (detail.specification as Record<string, unknown>) ?? {};
  const raw = Array.isArray(spec.invariants) ? (spec.invariants as unknown[]) : [];
  return raw.map((item) => {
    if (typeof item === "string") return { id: null, statement: item };
    const obj = item as Record<string, unknown>;
    return {
      id:        typeof obj.id        === "string" ? obj.id        : null,
      statement: typeof obj.statement === "string" ? obj.statement : JSON.stringify(obj),
    };
  });
}

function parseScope(detail: SpecDetail): ScopeData | null {
  const spec = (detail.specification as Record<string, unknown>) ?? {};
  const raw  = (detail.scope ?? spec.scope) as Record<string, unknown> | null | undefined;
  if (!raw) return null;
  return {
    in:  Array.isArray(raw.in)  ? (raw.in  as unknown[]).map(String) : raw.in  ? [String(raw.in)]  : [],
    out: Array.isArray(raw.out) ? (raw.out as unknown[]).map(String) : raw.out ? [String(raw.out)] : [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SpecLensProps {
  nodeId:  string;
  onClose: () => void;
}

const PANEL_W = 560;
const PANEL_H = 640;

export default function SpecLens({ nodeId, onClose }: SpecLensProps) {
  const panelRef  = useRef<HTMLDivElement>(null);
  const posRef    = useRef({ x: 60, y: 60 });
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Centre on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = {
      x: Math.max(20, (window.innerWidth  - PANEL_W) / 2),
      y: Math.max(20, (window.innerHeight - PANEL_H) / 2),
    };
    posRef.current = init;
    setPos(init);
  }, []);

  // ── Fetch spec data ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/spec-node?id=${encodeURIComponent(nodeId)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { setDetail(data.data ?? data.node ?? data); setLoading(false); })
      .catch((e)   => { setError(e.message); setLoading(false); });
  }, [nodeId]);

  // ── Escape closes ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Drag title bar ────────────────────────────────────────────────────────
  useLayoutEffect(() => { posRef.current = pos; });

  const onTitleBarMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const { x: origX, y: origY } = posRef.current;
    const startX = e.clientX, startY = e.clientY;
    const onMove = (ev: MouseEvent) =>
      setPos({ x: origX + ev.clientX - startX, y: origY + ev.clientY - startY });
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, []);

  // ── Parsed data ───────────────────────────────────────────────────────────
  const acceptance = detail
    ? (Array.isArray(detail.acceptance) ? (detail.acceptance as unknown[]) : []).map((v) => String(v))
    : [];

  const evidence = detail && Array.isArray(detail.acceptance_evidence)
    ? new Set(
        (detail.acceptance_evidence as Array<Record<string, unknown>>)
          .filter((ev) => ev && ev.evidence)
          .map((ev) => String(ev.criterion ?? "").trim())
          .filter(Boolean),
      )
    : new Set<string>();

  const decisions  = detail ? parseDecisions(detail)  : [];
  const invariants = detail ? parseInvariants(detail) : [];
  const scope      = detail ? parseScope(detail)      : null;

  const spec        = (detail?.specification as Record<string, unknown>) ?? {};
  const objective   = str(spec.objective ?? (detail as Record<string, unknown> | null)?.objective);

  const links = {
    depends_on: Array.isArray(detail?.depends_on) ? (detail!.depends_on as unknown[]).map(String) : [],
    refines:    Array.isArray(detail?.refines)    ? (detail!.refines    as unknown[]).map(String) : [],
    relates_to: Array.isArray(detail?.relates_to) ? (detail!.relates_to as unknown[]).map(String) : [],
  };
  const hasLinks = links.depends_on.length + links.refines.length + links.relates_to.length > 0;

  const status   = str(detail?.status);
  const maturity = typeof detail?.maturity === "number" ? detail.maturity : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      className="spec-lens-panel"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {/* Title bar */}
      <div className="spec-lens-titlebar" onMouseDown={onTitleBarMouseDown}>
        <span className="spec-lens-node-id">{nodeId}</span>
        {detail && (
          <span className={`spec-lens-status-badge sl-status-${status}`}>{status}</span>
        )}
        <span className="spec-lens-node-title">{str(detail?.title)}</span>
        <button className="spec-lens-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      {/* Body */}
      <div className="spec-lens-body">
        {loading && <div className="spec-lens-loading">Loading…</div>}
        {error   && <div className="spec-lens-error">Error: {error}</div>}

        {detail && !loading && (
          <>
            {/* Maturity bar */}
            {maturity !== null && (
              <div className="spec-lens-maturity">
                <span className="spec-lens-maturity-label">
                  maturity {Math.round(maturity * 100)}%
                </span>
                <div className="spec-lens-maturity-track">
                  <div
                    className="spec-lens-maturity-fill"
                    style={{ width: `${Math.min(1, Math.max(0, maturity)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Objective */}
            {objective && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">Objective</h3>
                <p className="spec-lens-prose">{objective}</p>
              </section>
            )}

            {/* Acceptance Criteria */}
            {acceptance.length > 0 && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">
                  Acceptance Criteria
                  <span className="spec-lens-count">{acceptance.length}</span>
                </h3>
                <ol className="spec-lens-ac-list">
                  {acceptance.map((ac, i) => {
                    const met = evidence.has(ac.trim());
                    return (
                      <li key={i} className={`spec-lens-ac-item${met ? " met" : ""}`}>
                        {met && <span className="spec-lens-check">✓</span>}
                        {ac}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Decisions */}
            {decisions.length > 0 && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">
                  Decisions
                  <span className="spec-lens-count">{decisions.length}</span>
                </h3>
                <div className="spec-lens-decisions">
                  {decisions.map((d, i) => (
                    <div key={i} className="spec-lens-decision">
                      {d.id && <span className="spec-lens-sub-id">{d.id}</span>}
                      <p className="spec-lens-decision-statement">{d.statement}</p>
                      {d.rationale && (
                        <p className="spec-lens-decision-rationale">{d.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Invariants */}
            {invariants.length > 0 && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">
                  Invariants
                  <span className="spec-lens-count">{invariants.length}</span>
                </h3>
                <ul className="spec-lens-inv-list">
                  {invariants.map((inv, i) => (
                    <li key={i} className="spec-lens-inv-item">
                      {inv.id && <span className="spec-lens-sub-id">{inv.id}</span>}
                      {inv.statement}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Scope */}
            {scope && (scope.in.length > 0 || scope.out.length > 0) && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">Scope</h3>
                {scope.in.length > 0 && (
                  <>
                    <p className="spec-lens-scope-label in">In scope</p>
                    <ul className="spec-lens-scope-list">
                      {scope.in.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </>
                )}
                {scope.out.length > 0 && (
                  <>
                    <p className="spec-lens-scope-label out">Out of scope</p>
                    <ul className="spec-lens-scope-list">
                      {scope.out.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </>
                )}
              </section>
            )}

            {/* Links */}
            {hasLinks && (
              <section className="spec-lens-section">
                <h3 className="spec-lens-section-title">Links</h3>
                {links.refines.length > 0 && (
                  <div className="spec-lens-link-row">
                    <span className="spec-lens-link-kind refines">refines</span>
                    {links.refines.map((id) => (
                      <span key={id} className="spec-lens-link-chip">{id}</span>
                    ))}
                  </div>
                )}
                {links.depends_on.length > 0 && (
                  <div className="spec-lens-link-row">
                    <span className="spec-lens-link-kind depends_on">depends_on</span>
                    {links.depends_on.map((id) => (
                      <span key={id} className="spec-lens-link-chip">{id}</span>
                    ))}
                  </div>
                )}
                {links.relates_to.length > 0 && (
                  <div className="spec-lens-link-row">
                    <span className="spec-lens-link-kind relates_to">relates_to</span>
                    {links.relates_to.map((id) => (
                      <span key={id} className="spec-lens-link-chip">{id}</span>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
