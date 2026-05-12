import { describe, expect, it, vi } from "vitest";
import {
  fetchSpecGraph,
  loadSpecGraph,
  SAMPLE_SPEC_GRAPH,
} from "../index";

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const cloneSample = () => JSON.parse(JSON.stringify(SAMPLE_SPEC_GRAPH));

describe("fetchSpecGraph", () => {
  it("returns live ok data from a valid /api/spec-graph response", async () => {
    const payload = cloneSample();
    const fetcher = vi.fn().mockResolvedValue(buildResponse(payload));
    const result = await fetchSpecGraph({ url: "/api/spec-graph", fetcher });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.graph.nodes).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith("/api/spec-graph", { signal: undefined });
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
