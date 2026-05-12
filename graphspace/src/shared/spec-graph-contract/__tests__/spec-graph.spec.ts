import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecGraph } from "../parsers/parse-spec-graph";
import {
  SPEC_GRAPH_EDGE_KINDS,
  SPEC_GRAPH_EDGE_STATUSES,
} from "../schemas/spec-graph";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, "../fixtures/spec_graph.golden.json");
const emptyPath = resolve(here, "../fixtures/spec_graph.empty.json");
const goldenText = readFileSync(goldenPath, "utf-8");
const emptyText = readFileSync(emptyPath, "utf-8");
const golden = JSON.parse(goldenText) as Record<string, unknown>;
const empty = JSON.parse(emptyText) as Record<string, unknown>;
const cloneGolden = () => JSON.parse(goldenText);

describe("parseSpecGraph", () => {
  it("parses the captured legacy /api/spec-graph response shape", () => {
    const result = parseSpecGraph(golden);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.spec_dir).toBe("/tmp/specgraph/specs/nodes");
    expect(result.data.graph.nodes).toHaveLength(3);
    expect(result.data.graph.edges).toHaveLength(3);
  });

  it("accepts an empty graph response", () => {
    const result = parseSpecGraph(empty);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.graph.summary.node_count).toBe(0);
  });

  it("accepts broken references as graph data, not parse failures", () => {
    const result = parseSpecGraph(golden);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const broken = result.data.graph.edges.find((edge) => edge.status === "broken");
    expect(broken?.target_id).toBe("SG-SPEC-9999");
    expect(result.data.graph.summary.broken_edge_count).toBe(1);
  });

  it("preserves additive node metadata for forward compatibility", () => {
    const future = cloneGolden();
    future.graph.nodes[0].authority_class = "distilled";
    future.graph.nodes[0].future_viewer_hint = { tone: "neutral" };
    const result = parseSpecGraph(future);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const node = result.data.graph.nodes[0] as Record<string, unknown>;
    expect(node.authority_class).toBe("distilled");
    expect(node.future_viewer_hint).toEqual({ tone: "neutral" });
  });

  it("flags graph.summary count mismatches as invariant-violation", () => {
    const broken = cloneGolden();
    broken.graph.summary.node_count = 99;
    expect(parseSpecGraph(broken).kind).toBe("invariant-violation");
  });

  it("flags top-level summary drift from graph.summary", () => {
    const broken = cloneGolden();
    broken.summary.edge_count = 99;
    expect(parseSpecGraph(broken).kind).toBe("invariant-violation");
  });

  it("flags missing root IDs as invariant-violation", () => {
    const broken = cloneGolden();
    broken.graph.roots.push("SG-SPEC-MISSING");
    broken.graph.summary.root_count += 1;
    broken.summary.root_count += 1;
    expect(parseSpecGraph(broken).kind).toBe("invariant-violation");
  });

  it("flags resolved edges whose endpoints do not resolve", () => {
    const broken = cloneGolden();
    broken.graph.edges[2].status = "resolved";
    broken.graph.summary.broken_edge_count = 0;
    broken.summary.broken_edge_count = 0;
    expect(parseSpecGraph(broken).kind).toBe("invariant-violation");
  });

  it("flags node gap_count contradictions", () => {
    const broken = cloneGolden();
    broken.graph.nodes[0].gap_count = 999;
    expect(parseSpecGraph(broken).kind).toBe("invariant-violation");
  });

  it("rejects unknown edge kinds", () => {
    const broken = cloneGolden();
    broken.graph.edges[0].edge_kind = "blocks";
    expect(parseSpecGraph(broken).kind).toBe("parse-error");
  });

  it("rejects unknown edge statuses", () => {
    const broken = cloneGolden();
    broken.graph.edges[0].status = "partial";
    expect(parseSpecGraph(broken).kind).toBe("parse-error");
  });

  it("rejects graph diagnostics without scope", () => {
    const broken = cloneGolden();
    delete broken.graph.diagnostics[0].scope;
    expect(parseSpecGraph(broken).kind).toBe("parse-error");
  });

  it("returns parse-error for arbitrary non-object input", () => {
    expect(parseSpecGraph(null).kind).toBe("parse-error");
    expect(parseSpecGraph("not json").kind).toBe("parse-error");
    expect(parseSpecGraph(42).kind).toBe("parse-error");
  });

  it("returns parse-error when the server response does not contain graph", () => {
    expect(parseSpecGraph({ nodes: [], edges: [] }).kind).toBe("parse-error");
  });

  it("locks known edge vocabulary to the legacy server contract", () => {
    expect([...SPEC_GRAPH_EDGE_KINDS]).toEqual([
      "depends_on",
      "refines",
      "relates_to",
    ]);
    expect([...SPEC_GRAPH_EDGE_STATUSES]).toEqual(["resolved", "broken"]);
  });
});
