/**
 * SpecLens — floating force-directed view of a single spec node.
 *
 * Centre  = the spec itself (node_id / title, coloured by status).
 * Orbit   = acceptance criteria, decisions, invariants, scope items, and
 *           outgoing links (refines / depends_on / relates_to).
 *
 * Clicking a link satellite switches the lens (and optionally the inspector)
 * to the linked spec.  The panel is draggable by its title bar and closes
 * on ✕ / Escape.
 */
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import "./SpecLens.css";

// ─── Raw API shape ────────────────────────────────────────────────────────────

type SpecDetail = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ─── Satellite datum ──────────────────────────────────────────────────────────

type SatKind =
  | "ac_met" | "ac_unmet"
  | "decision" | "invariant"
  | "scope_in" | "scope_out"
  | "link_refines" | "link_depends_on" | "link_relates_to";

interface SatNode extends d3.SimulationNodeDatum {
  id:         string;
  kind:       SatKind;
  label:      string;   // short label drawn inside circle / chip
  tooltip:    string;   // full text for hover
  linkId?:    string;   // node_id for link satellites (navigable)
  subItemId?: string;   // inspector sub-item id for content satellites
  isCenter?:  boolean;
}

interface SatLink extends d3.SimulationLinkDatum<SatNode> {}

const KIND_FILL: Record<SatKind, string> = {
  ac_met:          "#3e9a58",
  ac_unmet:        "#c8a72a",
  decision:        "#4e689b",
  invariant:       "#7c3aed",
  scope_in:        "#3e9a58",
  scope_out:       "#b54131",
  link_refines:    "#2d4a7a",
  link_depends_on: "#991b1b",
  link_relates_to: "#5b21b6",
};

const KIND_LABEL: Record<SatKind, string> = {
  ac_met:          "AC",
  ac_unmet:        "AC",
  decision:        "D",
  invariant:       "I",
  scope_in:        "IN",
  scope_out:       "OUT",
  link_refines:    "refines",
  link_depends_on: "depends",
  link_relates_to: "relates",
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface SpecLensProps {
  nodeId:  string;
  onClose: () => void;
  /** Called when user clicks a link satellite — switches the lens to that node
   *  (and typically updates the inspector selection too). */
  onNavigate?: (nodeId: string) => void;
  /** Currently-selected sub-item id in the Inspector (e.g. "acceptance-2"). */
  selectedSubItemId?: string | null;
  /** Called when a content satellite (AC/decision/invariant/scope) is clicked,
   *  with the inspector sub-item id (or null to clear). */
  onSelectSubItem?: (subItemId: string | null) => void;
}

const PANEL_W = 560;
const PANEL_H = 640;
const SVG_H   = 520;

const CENTER_R = 42;
const SAT_R    = 14;
const LINK_R   = 18;

export default function SpecLens({
  nodeId, onClose, onNavigate,
  selectedSubItemId, onSelectSubItem,
}: SpecLensProps) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, SatNode, SVGGElement, unknown> | null>(null);
  const posRef  = useRef({ x: 60, y: 60 });
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Stable callback refs — avoid restarting simulation when props change
  const navigateRef = useRef<((id: string) => void) | undefined>(undefined);
  const selectSubRef = useRef<((id: string | null) => void) | undefined>(undefined);
  const selectedSubRef = useRef<string | null | undefined>(selectedSubItemId);

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

  // Keep callback refs fresh
  useLayoutEffect(() => {
    navigateRef.current    = onNavigate;
    selectSubRef.current   = onSelectSubItem;
    selectedSubRef.current = selectedSubItemId;
  });

  // ── Build & run force simulation when detail changes ──────────────────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !detail) return;

    // Parse spec content -----------------------------------------------------
    const spec = (detail.specification as Record<string, unknown>) ?? {};
    const title     = str(detail.title);
    const status    = str(detail.status);
    const objective = str(spec.objective ?? detail.objective);

    const acceptance: string[] = Array.isArray(detail.acceptance)
      ? (detail.acceptance as unknown[]).map((v) => String(v))
      : [];

    const evidence = new Set<string>(
      Array.isArray(detail.acceptance_evidence)
        ? (detail.acceptance_evidence as Array<Record<string, unknown>>)
            .filter((ev) => ev && ev.evidence)
            .map((ev) => String(ev.criterion ?? "").trim())
            .filter(Boolean)
        : [],
    );

    const decisions: Array<{ id: string | null; statement: string; rationale: string | null }> =
      Array.isArray(spec.decisions)
        ? (spec.decisions as unknown[]).map((item) => {
            if (typeof item === "string") return { id: null, statement: item, rationale: null };
            const o = item as Record<string, unknown>;
            return {
              id:        typeof o.id        === "string" ? o.id        : null,
              statement: typeof o.statement === "string" ? o.statement
                       : typeof o.decision  === "string" ? o.decision  : JSON.stringify(o),
              rationale: typeof o.rationale === "string" ? o.rationale : null,
            };
          })
        : [];

    const invariants: Array<{ id: string | null; statement: string }> =
      Array.isArray(spec.invariants)
        ? (spec.invariants as unknown[]).map((item) => {
            if (typeof item === "string") return { id: null, statement: item };
            const o = item as Record<string, unknown>;
            return {
              id:        typeof o.id        === "string" ? o.id        : null,
              statement: typeof o.statement === "string" ? o.statement : JSON.stringify(o),
            };
          })
        : [];

    const scopeRaw = (detail.scope ?? spec.scope) as Record<string, unknown> | null | undefined;
    const scopeIn: string[]  = scopeRaw && Array.isArray(scopeRaw.in)
      ? (scopeRaw.in  as unknown[]).map(String) : [];
    const scopeOut: string[] = scopeRaw && Array.isArray(scopeRaw.out)
      ? (scopeRaw.out as unknown[]).map(String) : [];

    const refines:    string[] = Array.isArray(detail.refines)    ? (detail.refines    as unknown[]).map(String) : [];
    const dependsOn:  string[] = Array.isArray(detail.depends_on) ? (detail.depends_on as unknown[]).map(String) : [];
    const relatesTo:  string[] = Array.isArray(detail.relates_to) ? (detail.relates_to as unknown[]).map(String) : [];

    // Build satellite list ---------------------------------------------------
    const satellites: SatNode[] = [];

    acceptance.forEach((ac, i) => {
      const met = evidence.has(ac.trim());
      const subId = `acceptance-${i}`;
      satellites.push({
        id: subId, subItemId: subId,
        kind: met ? "ac_met" : "ac_unmet",
        label: String(i + 1),
        tooltip: (met ? "✓ " : "○ ") + ac,
      });
    });
    decisions.forEach((d, i) => {
      const subId = `decision-${i}`;
      satellites.push({
        id: subId, subItemId: subId,
        kind: "decision",
        label: d.id ?? `D${i + 1}`,
        tooltip: (d.id ? `${d.id}\n` : "") + d.statement + (d.rationale ? `\n\n${d.rationale}` : ""),
      });
    });
    invariants.forEach((inv, i) => {
      const subId = `invariant-${i}`;
      satellites.push({
        id: subId, subItemId: subId,
        kind: "invariant",
        label: inv.id ?? `I${i + 1}`,
        tooltip: (inv.id ? `${inv.id}\n` : "") + inv.statement,
      });
    });
    scopeIn.forEach((s, i) => {
      const subId = `scope_in-${i}`;
      satellites.push({ id: subId, subItemId: subId, kind: "scope_in",  label: KIND_LABEL.scope_in,  tooltip: s });
    });
    scopeOut.forEach((s, i) => {
      const subId = `scope_out-${i}`;
      satellites.push({ id: subId, subItemId: subId, kind: "scope_out", label: KIND_LABEL.scope_out, tooltip: s });
    });
    refines.forEach((id) => satellites.push({
      id: `lr-${id}`,  kind: "link_refines",    label: id, tooltip: `refines → ${id}`,    linkId: id,
    }));
    dependsOn.forEach((id) => satellites.push({
      id: `ld-${id}`,  kind: "link_depends_on", label: id, tooltip: `depends on → ${id}`, linkId: id,
    }));
    relatesTo.forEach((id) => satellites.push({
      id: `lt-${id}`,  kind: "link_relates_to", label: id, tooltip: `relates to → ${id}`, linkId: id,
    }));

    // Centre node
    const centre: SatNode = {
      id: "__center__",
      kind: "decision", // unused — rendered specially
      label: nodeId,
      tooltip: `${nodeId}\n${title}${objective ? `\n\n${objective}` : ""}`,
      isCenter: true,
    };

    const nodes: SatNode[] = [centre, ...satellites];
    const links: SatLink[] = satellites.map((s) => ({
      source: centre.id as unknown as SatNode,
      target: s.id      as unknown as SatNode,
    }));

    // SVG set-up -------------------------------------------------------------
    const W = PANEL_W;
    const H = SVG_H;

    const root = d3.select(svgEl);
    root.selectAll("*").remove();
    root.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);

    const g = root.append("g");

    // Ring by category (scatter initial positions in a circle)
    nodes.forEach((n, idx) => {
      if (n.isCenter) { n.x = W / 2; n.y = H / 2; return; }
      const angle = (2 * Math.PI * idx) / Math.max(1, satellites.length);
      n.x = W / 2 + Math.cos(angle) * 140;
      n.y = H / 2 + Math.sin(angle) * 140;
    });

    const sim = d3.forceSimulation<SatNode>(nodes)
      .force(
        "link",
        d3.forceLink<SatNode, SatLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const t = l.target as SatNode;
            return t.kind.startsWith("link_") ? 170 : 130;
          })
          .strength(0.45),
      )
      .force("charge",    d3.forceManyBody<SatNode>().strength((d) => d.isCenter ? -1400 : -260))
      .force("center",    d3.forceCenter(W / 2, H / 2).strength(0.06))
      .force("collision", d3.forceCollide<SatNode>((d) =>
        d.isCenter ? CENTER_R + 6 : (d.kind.startsWith("link_") ? LINK_R + 10 : SAT_R + 8),
      ));

    // Pin centre to middle
    const c = nodes[0];
    c.fx = W / 2;
    c.fy = H / 2;

    // Links ------------------------------------------------------------------
    const linkSel = g.append("g")
      .attr("class", "sl-fg-links")
      .selectAll<SVGLineElement, SatLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => {
        const t = d.target as SatNode;
        return KIND_FILL[t.kind] ?? "#aaa";
      })
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", (d) => {
        const t = d.target as SatNode;
        return t.kind.startsWith("link_") ? "3 4" : null;
      });

    // Nodes ------------------------------------------------------------------
    const nodeSel = g.append("g")
      .attr("class", "sl-fg-nodes")
      .selectAll<SVGGElement, SatNode>("g")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("cursor", (d) => d.linkId ? "pointer" : (d.isCenter ? "default" : "pointer"))
      .on("click", (_ev, d) => {
        if (d.linkId) {
          navigateRef.current?.(d.linkId);
          return;
        }
        if (d.subItemId) {
          const isSelected = selectedSubRef.current === d.subItemId;
          selectSubRef.current?.(isSelected ? null : d.subItemId);
        }
      });

    nodeSelRef.current = nodeSel;

    // Drag for satellites
    nodeSel.filter((d) => !d.isCenter).call(
      d3.drag<SVGGElement, SatNode>()
        .on("start", (ev, d) => {
          if (!ev.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag",  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on("end",   (ev, d) => {
          if (!ev.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        }),
    );

    // Tooltip
    nodeSel.append("title").text((d) => d.tooltip);

    // Centre node — larger circle with status fill + title inside
    const centreSel = nodeSel.filter((d) => !!d.isCenter);
    const CENTER_FILL: Record<string, string> = {
      idea: "#b0b0b0", stub: "#c8a72a", outlined: "#4e82b8",
      specified: "#6e5ab8", linked: "#3e9a58", reviewed: "#2a7c7c", frozen: "#4a5568",
    };
    centreSel.append("circle")
      .attr("r", CENTER_R)
      .attr("fill",         CENTER_FILL[status] ?? "#9b8ec4")
      .attr("fill-opacity", 0.22)
      .attr("stroke",       CENTER_FILL[status] ?? "#9b8ec4")
      .attr("stroke-width", 2);
    centreSel.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .attr("font-size", 10)
      .attr("font-family", "Courier New, monospace")
      .attr("fill", "#7c3aed")
      .attr("font-weight", 700)
      .attr("pointer-events", "none")
      .text(nodeId);
    centreSel.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 10)
      .attr("font-size", 9)
      .attr("font-family", "Georgia, serif")
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .text(() => {
        const words = title.split(/\s+/);
        let line = "";
        for (const w of words) {
          const t = line ? `${line} ${w}` : w;
          if (t.length > 18) break;
          line = t;
        }
        return line || title.slice(0, 16);
      });

    // Satellite nodes
    const satSel = nodeSel.filter((d) => !d.isCenter);
    satSel.append("circle")
      .attr("r", (d) => d.kind.startsWith("link_") ? LINK_R : SAT_R)
      .attr("fill",         (d) => KIND_FILL[d.kind])
      .attr("fill-opacity", 0.2)
      .attr("stroke",       (d) => KIND_FILL[d.kind])
      .attr("stroke-width", 1.5);
    satSel.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", (d) => d.kind.startsWith("link_") ? 9 : 10)
      .attr("font-family", "Courier New, monospace")
      .attr("font-weight", 600)
      .attr("fill", (d) => KIND_FILL[d.kind])
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // Radius helper for endpoint offset
    const nodeRadius = (n: SatNode) =>
      n.isCenter ? CENTER_R : n.kind.startsWith("link_") ? LINK_R : SAT_R;

    // Tick -------------------------------------------------------------------
    sim.on("tick", () => {
      linkSel.each(function (d) {
        const s = d.source as SatNode;
        const t = d.target as SatNode;
        const sx = s.x ?? 0, sy = s.y ?? 0;
        const tx = t.x ?? 0, ty = t.y ?? 0;
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const sr = nodeRadius(s), tr = nodeRadius(t);
        d3.select(this)
          .attr("x1", sx + (dx / dist) * sr)
          .attr("y1", sy + (dy / dist) * sr)
          .attr("x2", tx - (dx / dist) * tr)
          .attr("y2", ty - (dy / dist) * tr);
      });
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Ensure node layer is above link layer (painters order)
    nodeSel.raise();

    return () => { sim.stop(); nodeSelRef.current = null; };
  }, [detail, nodeId]);

  // ── Highlight selected sub-item without restarting simulation ─────────────
  useEffect(() => {
    const sel = nodeSelRef.current;
    if (!sel) return;
    sel.selectAll<SVGCircleElement, SatNode>("circle")
      .attr("stroke-width", (d) =>
        !d.isCenter && d.subItemId && d.subItemId === selectedSubItemId ? 3 : (d.isCenter ? 2 : 1.5),
      )
      .attr("fill-opacity", (d) =>
        !d.isCenter && d.subItemId && d.subItemId === selectedSubItemId ? 0.45 : (d.isCenter ? 0.22 : 0.2),
      );
    sel.filter((d) => !!d.subItemId && d.subItemId === selectedSubItemId).raise();
  }, [selectedSubItemId, detail]);

  // ── Stats for header ───────────────────────────────────────────────────────
  const status = str(detail?.status);
  const title  = str(detail?.title);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="spec-lens-panel"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {/* Title bar */}
      <div className="spec-lens-titlebar" onMouseDown={onTitleBarMouseDown}>
        <span className="spec-lens-node-id">{nodeId}</span>
        {detail && (
          <span className={`spec-lens-status-badge sl-status-${status}`}>{status}</span>
        )}
        <span className="spec-lens-node-title">{title}</span>
        <button className="spec-lens-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      {/* Body */}
      <div className="spec-lens-body spec-lens-body-graph">
        {loading && <div className="spec-lens-loading">Loading…</div>}
        {error   && <div className="spec-lens-error">Error: {error}</div>}
        {detail && !loading && (
          <>
            <svg ref={svgRef} className="spec-lens-svg" />
            <div className="spec-lens-legend">
              <span className="sl-leg sl-leg-ac-met">✓ AC met</span>
              <span className="sl-leg sl-leg-ac-unmet">○ AC</span>
              <span className="sl-leg sl-leg-decision">D decision</span>
              <span className="sl-leg sl-leg-invariant">I invariant</span>
              <span className="sl-leg sl-leg-scope-in">IN scope</span>
              <span className="sl-leg sl-leg-scope-out">OUT scope</span>
              <span className="sl-leg-hint">drag satellites · click link chip to navigate</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
