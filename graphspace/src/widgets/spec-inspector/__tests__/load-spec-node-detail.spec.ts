import { describe, expect, it, vi } from "vitest";
import { fetchSpecNodeDetail } from "../model";

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("fetchSpecNodeDetail", () => {
  it("fetches a focused spec-node detail response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse({
        node_id: "SG-SPEC-ROOT",
        data: {
          id: "SG-SPEC-ROOT",
          specification: { objective: "Define the root ontology." },
        },
      }),
    );

    const result = await fetchSpecNodeDetail({
      nodeId: "SG-SPEC-ROOT",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/spec-node?id=SG-SPEC-ROOT",
      { signal: undefined },
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.data.specification?.objective).toBe(
      "Define the root ontology.",
    );
  });

  it("returns http-error without throwing for missing nodes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        buildResponse({ error: "not found" }, { status: 404, statusText: "Not Found" }),
      );

    const result = await fetchSpecNodeDetail({
      nodeId: "SG-SPEC-MISSING",
      fetcher,
    });

    expect(result.kind).toBe("http-error");
  });

  it("returns parse-error for malformed payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({ node_id: "SG" }));
    const result = await fetchSpecNodeDetail({ nodeId: "SG", fetcher });
    expect(result.kind).toBe("parse-error");
  });
});
