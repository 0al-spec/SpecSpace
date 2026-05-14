import { describe, expect, it, vi } from "vitest";
import {
  fetchSpecGraph,
  buildSpecGraphSelection,
  loadSpecGraph,
  SAMPLE_SPEC_GRAPH,
  toSpecGraphFlowElements,
} from "../index";

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const cloneSample = () => JSON.parse(JSON.stringify(SAMPLE_SPEC_GRAPH));

describe("fetchSpecGraph", () => {
  it("returns live ok data from a valid /api/v1/spec-graph response", async () => {
    const payload = cloneSample();
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));
    const result = await fetchSpecGraph({ fetcher });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.graph.nodes).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith("/api/v1/spec-graph", { signal: undefined });
  });

  it("returns response-error when the body is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("<html>oops</html>", { headers: { "Content-Type": "text/html" } }),
    );
    const result = await fetchSpecGraph({ fetcher });
    expect(result.kind).toBe("response-error");
  });

  it("rethrows AbortError so React effects can ignore unmount cancellation", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetcher = vi.fn().mockRejectedValue(abort);
    await expect(fetchSpecGraph({ fetcher })).rejects.toBe(abort);
  });
});

describe("loadSpecGraph", () => {
  it("returns live state on success", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(cloneSample()));
    const state = await loadSpecGraph({ fetcher });
    expect(state.kind).toBe("ok");
    expect(state.source).toBe("live");
  });

  it("returns sample fallback on HTTP failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(buildResponse({ error: "spec graph disabled" }, { status: 404, statusText: "Not Found" }));
    const state = await loadSpecGraph({ fetcher });

    expect(state.kind).toBe("sample");
    if (state.kind !== "sample") return;
    expect(state.data).toBe(SAMPLE_SPEC_GRAPH);
    expect(state.failure.kind).toBe("http-error");
  });

  it("returns sample fallback on network failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const state = await loadSpecGraph({ fetcher });

    expect(state.kind).toBe("sample");
    if (state.kind !== "sample") return;
    expect(state.failure.kind).toBe("network-error");
  });

  it("returns sample fallback on invalid payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({ nodes: [], edges: [] }));
    const state = await loadSpecGraph({ fetcher });

    expect(state.kind).toBe("sample");
    if (state.kind !== "sample") return;
    expect(state.failure.kind).toBe("parse-error");
  });

  it("returns sample fallback on contract invariant violations", async () => {
    const payload = cloneSample();
    payload.graph.summary.node_count = 999;
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));
    const state = await loadSpecGraph({ fetcher });

    expect(state.kind).toBe("sample");
    if (state.kind !== "sample") return;
    expect(state.failure.kind).toBe("invariant-violation");
  });
});

describe("toSpecGraphFlowElements", () => {
  it("maps sample graph nodes into deterministic flow positions", () => {
    const { nodes, edges } = toSpecGraphFlowElements(SAMPLE_SPEC_GRAPH);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(nodes).toHaveLength(3);
    expect(nodes.map((node) => node.id)).toEqual([
      "SG-SPEC-SAMPLE-EVIDENCE",
      "SG-SPEC-SAMPLE-ROOT",
      "SG-SPEC-SAMPLE-RUNTIME",
    ]);
    expect(byId.get("SG-SPEC-SAMPLE-EVIDENCE")?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(byId.get("SG-SPEC-SAMPLE-ROOT")?.position).toEqual({ x: 0, y: 172 });
    expect(byId.get("SG-SPEC-SAMPLE-RUNTIME")?.position).toEqual({
      x: 360,
      y: 0,
    });
    expect(edges).toHaveLength(3);
  });

  it("keeps node positions and edge order stable when payload order changes", () => {
    const response = cloneSample();
    response.graph.nodes = [...response.graph.nodes].reverse();
    response.graph.edges = [...response.graph.edges].reverse();

    const { nodes, edges } = toSpecGraphFlowElements(response);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(nodes.map((node) => node.id)).toEqual([
      "SG-SPEC-SAMPLE-EVIDENCE",
      "SG-SPEC-SAMPLE-ROOT",
      "SG-SPEC-SAMPLE-RUNTIME",
    ]);
    expect(byId.get("SG-SPEC-SAMPLE-EVIDENCE")?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(byId.get("SG-SPEC-SAMPLE-ROOT")?.position).toEqual({ x: 0, y: 172 });
    expect(byId.get("SG-SPEC-SAMPLE-RUNTIME")?.position).toEqual({
      x: 360,
      y: 0,
    });
    expect(edges.map((edge) => edge.id)).toEqual([
      "SG-SPEC-SAMPLE-ROOT__depends_on__SG-SPEC-SAMPLE-RUNTIME",
      "SG-SPEC-SAMPLE-ROOT__relates_to__SG-SPEC-SAMPLE-EVIDENCE",
      "SG-SPEC-SAMPLE-RUNTIME__refines__SG-SPEC-SAMPLE-ROOT",
    ]);
  });

  it("renders refines edges in hierarchy direction while preserving raw edge data", () => {
    const { edges } = toSpecGraphFlowElements(SAMPLE_SPEC_GRAPH);
    const refines = edges.find(
      (edge) => edge.id === "SG-SPEC-SAMPLE-RUNTIME__refines__SG-SPEC-SAMPLE-ROOT",
    );
    expect(refines?.source).toBe("SG-SPEC-SAMPLE-ROOT");
    expect(refines?.target).toBe("SG-SPEC-SAMPLE-RUNTIME");
    expect(refines?.data?.specEdge.source_id).toBe("SG-SPEC-SAMPLE-RUNTIME");
    expect(refines?.data?.specEdge.target_id).toBe("SG-SPEC-SAMPLE-ROOT");
  });

  it("styles edge kinds distinctly", () => {
    const { edges } = toSpecGraphFlowElements(SAMPLE_SPEC_GRAPH);
    const styles = new Map(
      edges.map((edge) => [edge.data?.specEdge.edge_kind, edge.style]),
    );
    expect(styles.get("depends_on")).toMatchObject({ stroke: "#b06924" });
    expect(styles.get("refines")).toMatchObject({
      stroke: "#4e689b",
      strokeDasharray: "6 4",
    });
    expect(styles.get("relates_to")).toMatchObject({
      stroke: "#7c3aed",
      strokeDasharray: "2 6",
    });
  });

  it("keeps cyclic refines ranks bounded", () => {
    const response = cloneSample();
    response.graph.edges.push({
      edge_id: "SG-SPEC-SAMPLE-ROOT__refines__SG-SPEC-SAMPLE-RUNTIME",
      edge_kind: "refines",
      source_id: "SG-SPEC-SAMPLE-ROOT",
      target_id: "SG-SPEC-SAMPLE-RUNTIME",
      status: "resolved",
    });

    const { nodes } = toSpecGraphFlowElements(response);
    const maxX = Math.max(...nodes.map((node) => node.position.x));
    expect(maxX).toBeLessThanOrEqual(360);
  });

  it("filters edges whose endpoints are missing from the node set", () => {
    const response = cloneSample();
    response.graph.edges.push({
      edge_id: "missing",
      edge_kind: "relates_to",
      source_id: "SG-SPEC-SAMPLE-ROOT",
      target_id: "SG-SPEC-MISSING",
      status: "broken",
    });
    response.graph.summary.edge_count += 1;
    response.summary.edge_count += 1;
    response.graph.summary.broken_edge_count += 1;
    response.summary.broken_edge_count += 1;

    const { edges } = toSpecGraphFlowElements(response);
    expect(edges.map((edge) => edge.id)).not.toContain("missing");
  });
});

describe("buildSpecGraphSelection", () => {
  it("returns the selected node with graph context for inspector surfaces", () => {
    const selection = buildSpecGraphSelection(
      SAMPLE_SPEC_GRAPH,
      "SG-SPEC-SAMPLE-ROOT",
    );

    expect(selection?.node.node_id).toBe("SG-SPEC-SAMPLE-ROOT");
    expect(selection?.specDir).toBe("sample://graphspace/specs/nodes");
    expect(selection?.nodes).toHaveLength(3);
    expect(selection?.edges).toHaveLength(3);
  });

  it("returns null when the selected node no longer exists", () => {
    expect(buildSpecGraphSelection(SAMPLE_SPEC_GRAPH, "SG-SPEC-MISSING")).toBeNull();
    expect(buildSpecGraphSelection(SAMPLE_SPEC_GRAPH, null)).toBeNull();
  });
});
