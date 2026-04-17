import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import type { ApiSpecGraph } from "./types";
import "./SpecLens.css";

// ─── Colour maps ────────────────────────────────────────────────────────────

const STATUS_FILL: Record<string, string> = {
  idea:      "#b0b0b0",
  stub:      "#c8a72a",
  outlined:  "#4e82b8",
  specified: "#6e5ab8",
  linked:    "#3e9a58",
  reviewed:  "#2a7c7c",
  frozen:    "#4a5568",
};

const EDGE_COLOR: Record<string, string> = {
  refines:    "#4e689b",
  depends_on: "#dc2626",
  relates_to: "#7c3aed",
};

const EDGE_DASH: Record<string, string | null> = {
  refines:    "6 3",
  depends_on: null,
  relates_to: "3 6",
};

// ─── D3 datum types ─────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  node_id: string;
  title: string;
  kind: string;
  status: string;
  isCenter: boolean;
}

type EdgeKind = "depends_on" | "refines" | "relates_to";

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edge_id: string;
  edge_kind: EdgeKind;
}

// ─── Subgraph extraction ─────────────────────────────────────────────────────

function buildSubgraph(
  apiGraph: ApiSpecGraph,
  centerNodeId: string,
  hops: number,
): { nodes: SimNode[]; links: SimLink[] } {
  // BFS: collect node IDs within `hops` hops from center
  const nodeSet = new Set<string>([centerNodeId]);
  let frontier = [centerNodeId];

  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const e of apiGraph.edges) {
      if (e.status !== "resolved") continue;
      for (const id of frontier) {
        if (e.source_id === id && !nodeSet.has(e.target_id)) {
          nodeSet.add(e.target_id);
          next.push(e.target_id);
        }
        if (e.target_id === id && !nodeSet.has(e.source_id)) {
          nodeSet.add(e.source_id);
          next.push(e.source_id);
        }
      }
    }
    frontier = next;
  }

  // All resolved edges between collected nodes
  const seen = new Set<string>();
  const links: SimLink[] = [];
  for (const e of apiGraph.edges) {
    if (e.status !== "resolved") continue;
    if (nodeSet.has(e.source_id) && nodeSet.has(e.target_id) && !seen.has(e.edge_id)) {
      seen.add(e.edge_id);
      links.push({
        edge_id: e.edge_id,
        edge_kind: e.edge_kind as EdgeKind,
        // D3 accepts string IDs when forceLink has an .id() accessor
        source: e.source_id as unknown as SimNode,
        target: e.target_id as unknown as SimNode,
      });
    }
  }

  const nodes: SimNode[] = apiGraph.nodes
    .filter((n) => nodeSet.has(n.node_id))
    .map((n) => ({
      node_id: n.node_id,
      title:   n.title,
      kind:    n.kind,
      status:  n.status,
      isCenter: n.node_id === centerNodeId,
    }));

  return { nodes, links };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface SpecLensProps {
  nodeId:       string;
  apiGraph:     ApiSpecGraph;
  onClose:      () => void;
  /** Called when the user clicks a neighbor node in the lens */
  onSelectNode: (nodeId: string) => void;
}

export default function SpecLens({ nodeId, apiGraph, onClose, onSelectNode }: SpecLensProps) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const [pos, setPos]   = useState({ x: 60, y: 60 });
  const [hops, setHops] = useState(1);

  // Keep onSelectNode stable inside the D3 effect
  const onSelectNodeRef = useRef(onSelectNode);
  useLayoutEffect(() => { onSelectNodeRef.current = onSelectNode; });

  // ── Center panel on first mount (position: fixed → relative to viewport) ─
  useEffect(() => {
    setPos({
      x: Math.max(20, (window.innerWidth  - 640) / 2),
      y: Math.max(20, (window.innerHeight - 500) / 2),
    });
  }, []);

  // ── Drag title bar ───────────────────────────────────────────────────────
  const posRef = useRef(pos);
  useLayoutEffect(() => { posRef.current = pos; });

  const onTitleBarMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,input,label")) return;
    e.preventDefault();
    const { x: origX, y: origY } = posRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: MouseEvent) =>
      setPos({ x: origX + ev.clientX - startX, y: origY + ev.clientY - startY });
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // ── D3 force simulation ──────────────────────────────────────────────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const W = svgEl.clientWidth  || 640;
    const H = svgEl.clientHeight || 440;

    const { nodes, links } = buildSubgraph(apiGraph, nodeId, hops);

    // Initial positions: center node at canvas center, others spread around it
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      x: W / 2 + (n.isCenter ? 0 : (Math.random() - 0.5) * 220),
      y: H / 2 + (n.isCenter ? 0 : (Math.random() - 0.5) * 220),
    }));

    const root = d3.select(svgEl);
    root.selectAll("*").remove();

    // Zoom / pan layer
    const g = root.append("g");
    root.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (ev) => g.attr("transform", ev.transform)),
    );

    // Arrow-head markers (one per edge kind)
    const defs = root.append("defs");
    for (const [kind, color] of Object.entries(EDGE_COLOR)) {
      defs.append("marker")
        .attr("id", `la-${kind}`)
        .attr("markerWidth", 8).attr("markerHeight", 6)
        .attr("refX", 8).attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L8,3 z")
        .attr("fill", color)
        .attr("opacity", 0.8);
    }

    // Force simulation
    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.node_id)
          .distance((l) => (l.edge_kind === "refines" ? 170 : 140))
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-700))
      .force("center",    d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>((d) => (d.isCenter ? 58 : 46)));

    // Node radius helper
    const R = (n: SimNode) => (n.isCenter ? 46 : 34);

    // ── Edges ──────────────────────────────────────────────────────────────
    const linkSel = g.append("g")
      .attr("class", "lens-links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links)
      .join("line")
      .attr("stroke",        (d) => EDGE_COLOR[d.edge_kind] ?? "#999")
      .attr("stroke-width",  (d) => (d.edge_kind === "depends_on" ? 2.5 : 1.8))
      .attr("stroke-dasharray", (d) => EDGE_DASH[d.edge_kind] ?? null)
      .attr("opacity", 0.6)
      .attr("marker-end", (d) => `url(#la-${d.edge_kind})`);

    // Edge kind labels
    const edgeLabelSel = g.append("g")
      .selectAll<SVGTextElement, SimLink>("text")
      .data(links)
      .join("text")
      .attr("font-size",   9)
      .attr("font-family", "Courier New, monospace")
      .attr("fill",        (d) => EDGE_COLOR[d.edge_kind] ?? "#999")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .attr("opacity", 0.75)
      .text((d) => d.edge_kind);

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodeSel = g.append("g")
      .attr("class", "lens-nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, (d) => d.node_id)
      .join("g")
      .attr("cursor", (d) => (d.isCenter ? "default" : "pointer"))
      .on("click", (_ev, d) => {
        if (!d.isCenter) onSelectNodeRef.current(d.node_id);
      });

    // Drag behaviour
    nodeSel.call(
      d3.drag<SVGGElement, SimNode>()
        .on("start", (ev, d) => {
          if (!ev.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (ev, d) => {
          d.fx = ev.x;
          d.fy = ev.y;
        })
        .on("end", (ev, d) => {
          if (!ev.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    // Circle background
    nodeSel.append("circle")
      .attr("r",            (d) => R(d))
      .attr("fill",         (d) => STATUS_FILL[d.status] ?? "#9b8ec4")
      .attr("fill-opacity", (d) => (d.isCenter ? 0.22 : 0.12))
      .attr("stroke",       (d) => (d.isCenter ? "#7c3aed" : (STATUS_FILL[d.status] ?? "#9b8ec4")))
      .attr("stroke-width", (d) => (d.isCenter ? 2.5 : 1.5));

    // Node-id label (above circle)
    nodeSel.append("text")
      .attr("y",           (d) => -R(d) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size",   8)
      .attr("font-family", "Courier New, monospace")
      .attr("fill",        "#888")
      .attr("pointer-events", "none")
      .text((d) => d.node_id);

    // Title (word-wrapped inside circle)
    nodeSel.append("text")
      .attr("text-anchor",  "middle")
      .attr("fill",         "#222")
      .attr("pointer-events", "none")
      .each(function (d) {
        const el      = d3.select(this);
        const maxR    = R(d);
        const fSize   = d.isCenter ? 10 : 9;
        const lineH   = fSize + 2;
        const maxCh   = Math.floor((maxR * 1.8) / (fSize * 0.58));
        const maxLines = 3;

        el.attr("font-size",   fSize)
          .attr("font-weight", d.isCenter ? "bold" : "normal")
          .attr("font-family", "Georgia, serif");

        const words = d.title.split(/\s+/);
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          if (lines.length >= maxLines) break;
          const test = cur ? `${cur} ${w}` : w;
          if (test.length <= maxCh) {
            cur = test;
          } else {
            if (cur) lines.push(cur);
            cur = w.length > maxCh ? w.slice(0, maxCh - 1) + "…" : w;
          }
        }
        if (cur && lines.length < maxLines) {
          lines.push(cur.length > maxCh ? cur.slice(0, maxCh - 1) + "…" : cur);
        }

        const totalH = lines.length * lineH;
        lines.forEach((line, i) => {
          el.append("tspan")
            .attr("x",  0)
            .attr("dy", i === 0 ? -totalH / 2 + lineH / 2 : lineH)
            .text(line);
        });
      });

    // Status badge (below circle)
    nodeSel.append("text")
      .attr("y",           (d) => R(d) + 13)
      .attr("text-anchor", "middle")
      .attr("font-size",   8)
      .attr("font-family", "Courier New, monospace")
      .attr("fill",        (d) => STATUS_FILL[d.status] ?? "#9b8ec4")
      .attr("pointer-events", "none")
      .text((d) => d.status);

    // ── Tick: update positions ─────────────────────────────────────────────
    sim.on("tick", () => {
      // Edge: draw from circle edge to circle edge (with arrowhead clearance)
      linkSel.each(function (d) {
        const src = d.source as SimNode;
        const tgt = d.target as SimNode;
        const sx = src.x ?? 0, sy = src.y ?? 0;
        const tx = tgt.x ?? 0, ty = tgt.y ?? 0;
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        d3.select(this)
          .attr("x1", sx + (dx / dist) * R(src))
          .attr("y1", sy + (dy / dist) * R(src))
          .attr("x2", tx - (dx / dist) * (R(tgt) + 10))
          .attr("y2", ty - (dy / dist) * (R(tgt) + 10));
      });

      edgeLabelSel
        .attr("x", (d) => {
          const s = d.source as SimNode, t = d.target as SimNode;
          return ((s.x ?? 0) + (t.x ?? 0)) / 2;
        })
        .attr("y", (d) => {
          const s = d.source as SimNode, t = d.target as SimNode;
          return ((s.y ?? 0) + (t.y ?? 0)) / 2 - 5;
        });

      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
  }, [apiGraph, nodeId, hops]);

  // ── Render ────────────────────────────────────────────────────────────────
  const centerNode = apiGraph.nodes.find((n) => n.node_id === nodeId);
  const neighborCount = (() => {
    const set = new Set<string>();
    for (const e of apiGraph.edges) {
      if (e.status !== "resolved") continue;
      if (e.source_id === nodeId) set.add(e.target_id);
      if (e.target_id === nodeId) set.add(e.source_id);
    }
    return set.size;
  })();

  return (
    <div
      ref={panelRef}
      className="spec-lens-panel"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {/* Title bar — drag handle */}
      <div className="spec-lens-titlebar" onMouseDown={onTitleBarMouseDown}>
        <span className="spec-lens-node-id">{nodeId}</span>
        <span className="spec-lens-node-title">{centerNode?.title ?? ""}</span>
        <div className="spec-lens-controls">
          <label className="spec-lens-hop-toggle" title="Show second-degree neighbors">
            <input
              type="checkbox"
              checked={hops === 2}
              onChange={(e) => setHops(e.target.checked ? 2 : 1)}
            />
            2&nbsp;hops
          </label>
          <span className="spec-lens-neighbor-count">{neighborCount} neighbors</span>
          <button className="spec-lens-close" onClick={onClose} title="Close lens (Escape)">✕</button>
        </div>
      </div>

      {/* Legend */}
      <div className="spec-lens-legend">
        {(["refines", "depends_on", "relates_to"] as EdgeKind[]).map((k) => (
          <span key={k} className="spec-lens-legend-item">
            <svg width="22" height="10">
              <line
                x1="2" y1="5" x2="20" y2="5"
                stroke={EDGE_COLOR[k]}
                strokeWidth="1.8"
                strokeDasharray={EDGE_DASH[k] ?? undefined}
              />
            </svg>
            {k}
          </span>
        ))}
      </div>

      {/* D3 canvas */}
      <svg ref={svgRef} className="spec-lens-svg" />
    </div>
  );
}
