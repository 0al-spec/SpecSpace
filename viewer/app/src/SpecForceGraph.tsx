/**
 * SpecForceGraph — full-canvas D3 force-directed view of the entire spec graph.
 * Rendered as a 4th view mode alongside Tree / Linear / Canonical.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import * as d3 from "d3";
import type { ApiSpecGraph } from "./types";
import "./SpecForceGraph.css";

// ─── Colours ─────────────────────────────────────────────────────────────────

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
  depends_on: "#c08820",  // amber — depends_on = required dependency, not an error
  relates_to: "#7c3aed",
};

const EDGE_DASH: Record<string, string | null> = {
  refines:    "6 3",
  depends_on: null,
  relates_to: "3 6",
};

type EdgeKind = "depends_on" | "refines" | "relates_to";

// ─── D3 datum types ───────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  node_id: string;
  title: string;
  kind: string;
  status: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edge_id: string;
  edge_kind: EdgeKind;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SpecForceGraphProps {
  apiGraph: ApiSpecGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const NODE_R   = 22;   // default radius
const SEL_R    = 30;   // radius when selected
const SEL_COLOR = "#7c3aed";

export default function SpecForceGraph({
  apiGraph,
  selectedNodeId,
  onSelectNode,
}: SpecForceGraphProps) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null>(null);
  const simRef     = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Stable callback ref — avoids restarting the simulation when the closure changes
  const onSelectRef = useRef(onSelectNode);
  useLayoutEffect(() => { onSelectRef.current = onSelectNode; });

  // ── Build and run the simulation once (or when graph data changes) ─────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Use the SVG's actual rendered dimensions
    const W = svgEl.clientWidth  || window.innerWidth  - 240;
    const H = svgEl.clientHeight || window.innerHeight;

    // Build sim data
    const simNodes: SimNode[] = apiGraph.nodes.map((n) => ({
      node_id: n.node_id,
      title:   n.title,
      kind:    n.kind,
      status:  n.status,
      // scatter initial positions across canvas so the layout starts spread out
      x: W * 0.1 + Math.random() * W * 0.8,
      y: H * 0.1 + Math.random() * H * 0.8,
    }));

    const links: SimLink[] = apiGraph.edges
      .filter((e) => e.status === "resolved")
      .map((e) => ({
        edge_id:   e.edge_id,
        edge_kind: e.edge_kind as EdgeKind,
        source: e.source_id as unknown as SimNode,
        target: e.target_id as unknown as SimNode,
      }));

    // ── SVG setup ────────────────────────────────────────────────────────────
    const root = d3.select(svgEl);
    root.selectAll("*").remove();

    // Zoom / pan
    const g = root.append("g");
    root.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (ev) => g.attr("transform", ev.transform)),
    );

    // Arrow markers
    const defs = root.append("defs");
    for (const [kind, color] of Object.entries(EDGE_COLOR)) {
      defs.append("marker")
        .attr("id", `sfg-arrow-${kind}`)
        .attr("markerWidth", 7).attr("markerHeight", 6)
        .attr("refX", 7).attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L7,3 z")
        .attr("fill", color)
        .attr("opacity", 0.7);
    }

    // ── Force simulation ──────────────────────────────────────────────────────
    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.node_id)
          .distance((l) => l.edge_kind === "refines" ? 130 : 100)
          .strength(0.4),
      )
      .force("charge",    d3.forceManyBody<SimNode>().strength(-500))
      .force("center",    d3.forceCenter(W / 2, H / 2).strength(0.05))
      .force("collision", d3.forceCollide<SimNode>(NODE_R + 14));

    simRef.current = sim;

    // ── Edges ─────────────────────────────────────────────────────────────────
    const linkSel = g.append("g")
      .attr("class", "sfg-links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links)
      .join("line")
      .attr("stroke",           (d) => EDGE_COLOR[d.edge_kind] ?? "#999")
      .attr("stroke-width",     (d) => d.edge_kind === "depends_on" ? 2 : 1.5)
      .attr("stroke-dasharray", (d) => EDGE_DASH[d.edge_kind] ?? null)
      .attr("opacity", 0.45)
      .attr("marker-end", (d) => `url(#sfg-arrow-${d.edge_kind})`);

    // ── Nodes ──────────────────────────────────────────────────────────────────
    const nodeSel = g.append("g")
      .attr("class", "sfg-nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, (d) => d.node_id)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_ev, d) => onSelectRef.current(d.node_id));

    nodeSelRef.current = nodeSel;

    // Drag
    nodeSel.call(
      d3.drag<SVGGElement, SimNode>()
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

    // Circle
    nodeSel.append("circle")
      .attr("class", "sfg-node-circle")
      .attr("r",            NODE_R)
      .attr("fill",         (d) => STATUS_FILL[d.status] ?? "#9b8ec4")
      .attr("fill-opacity", 0.18)
      .attr("stroke",       (d) => STATUS_FILL[d.status] ?? "#9b8ec4")
      .attr("stroke-width", 1.5);

    // Tooltip (title = browser native tooltip on hover)
    nodeSel.append("title").text((d) => `${d.node_id}\n${d.title}\n${d.status}`);

    // Node-ID label (below circle)
    nodeSel.append("text")
      .attr("y",           NODE_R + 11)
      .attr("text-anchor", "middle")
      .attr("font-size",   8)
      .attr("font-family", "Fira Code, Courier New, monospace")
      .attr("fill",        "#777")
      .attr("pointer-events", "none")
      .text((d) => d.node_id);

    // Short title inside circle (1 line, truncated)
    nodeSel.append("text")
      .attr("text-anchor",    "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size",      8)
      .attr("font-family",    "Georgia, serif")
      .attr("fill",           "#333")
      .attr("pointer-events", "none")
      .text((d) => {
        const words = d.title.split(/\s+/);
        let line = "";
        for (const w of words) {
          const t = line ? `${line} ${w}` : w;
          if (t.length > 16) break;
          line = t;
        }
        return line || d.title.slice(0, 14);
      });

    // ── Tick ─────────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      linkSel.each(function (d) {
        const src = d.source as SimNode;
        const tgt = d.target as SimNode;
        const sx = src.x ?? 0, sy = src.y ?? 0;
        const tx = tgt.x ?? 0, ty = tgt.y ?? 0;
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        d3.select(this)
          .attr("x1", sx + (dx / dist) * NODE_R)
          .attr("y1", sy + (dy / dist) * NODE_R)
          .attr("x2", tx - (dx / dist) * (NODE_R + 9))
          .attr("y2", ty - (dy / dist) * (NODE_R + 9));
      });
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
      simRef.current = null;
      nodeSelRef.current = null;
    };
  }, [apiGraph]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update selected-node highlight without restarting simulation ───────────
  useEffect(() => {
    const sel = nodeSelRef.current;
    if (!sel) return;

    sel.selectAll<SVGCircleElement, SimNode>(".sfg-node-circle")
      .attr("r",            (d) => d.node_id === selectedNodeId ? SEL_R : NODE_R)
      .attr("stroke",       (d) =>
        d.node_id === selectedNodeId ? SEL_COLOR : (STATUS_FILL[d.status] ?? "#9b8ec4"),
      )
      .attr("stroke-width", (d) => d.node_id === selectedNodeId ? 2.5 : 1.5)
      .attr("fill-opacity", (d) => d.node_id === selectedNodeId ? 0.28 : 0.18);

    // Also raise the selected node to top so it's not hidden behind neighbours
    sel.filter((d) => d.node_id === selectedNodeId).raise();
  }, [selectedNodeId]);

  // ── Legend ────────────────────────────────────────────────────────────────
  return (
    <div className="sfg-container">
      <svg ref={svgRef} className="sfg-svg" />
      <div className="sfg-legend">
        {(["refines", "depends_on", "relates_to"] as EdgeKind[]).map((k) => (
          <span key={k} className="sfg-legend-item">
            <svg width="22" height="10">
              <line
                x1="2" y1="5" x2="20" y2="5"
                stroke={EDGE_COLOR[k]}
                strokeWidth="1.8"
                strokeDasharray={EDGE_DASH[k] ?? undefined}
              />
            </svg>
            {k === "depends_on" ? "requires" : k}
          </span>
        ))}
        <span className="sfg-legend-hint">scroll to zoom · drag node to pin · click to inspect</span>
      </div>
    </div>
  );
}
