import { describe, it, expect, vi } from "vitest";
import { fetchEnvelope } from "../client";
import type { ParseResult } from "../spec-graph-contract";

type Stub = { x: number };

const okParse = (raw: unknown): ParseResult<Stub> => {
  if (raw && typeof raw === "object" && "x" in raw && typeof (raw as Stub).x === "number") {
    return { kind: "ok", data: raw as Stub };
  }
  return { kind: "parse-error", issues: [], raw };
};

const versionGuardParse =
  (max: number, declared: number) =>
  (raw: unknown): ParseResult<Stub> => {
    if (declared > max) {
      return {
        kind: "version-not-supported",
        artifact_kind: "stub",
        schema_version: declared,
        max_supported: max,
      };
    }
    return okParse(raw);
  };

const buildResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const envelope = (data: unknown) => ({
  path: "/runs/sample.json",
  mtime: 100,
  mtime_iso: "2026-05-10T12:00:00Z",
  data,
});

describe("fetchEnvelope", () => {
  it("returns ok with parsed data and meta on a healthy envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(envelope({ x: 1 })));
    const result = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data).toEqual({ x: 1 });
    expect(result.meta.path).toBe("/runs/sample.json");
    expect(result.meta.mtime).toBe(100);
  });

  it("forwards http-error with status and statusText", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(buildResponse({ error: "not built" }, { status: 404, statusText: "Not Found" }));
    const result = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(result.kind).toBe("http-error");
    if (result.kind !== "http-error") return;
    expect(result.status).toBe(404);
    expect(result.statusText).toBe("Not Found");
  });

  it("captures network errors as network-error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(result.kind).toBe("network-error");
  });

  it("re-throws AbortError so React effects can ignore it", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetcher = vi.fn().mockRejectedValue(abort);
    await expect(fetchEnvelope({ url: "/api/x", parse: okParse, fetcher })).rejects.toBe(abort);
  });

  it("re-throws AbortError thrown by response.json() too (Codex P2 #8)", async () => {
    // Cancellation can happen after headers arrive but before the body is
    // fully read — fetch resolves, json() rejects with AbortError. Must
    // not become envelope-error.
    const abort = Object.assign(new Error("aborted body"), { name: "AbortError" });
    const fakeResponse = {
      ok: true,
      json: () => Promise.reject(abort),
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(fakeResponse);
    await expect(fetchEnvelope({ url: "/api/x", parse: okParse, fetcher })).rejects.toBe(abort);
  });

  it("rejects payloads that don't look like the runs envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse({ entries: [] }));
    const result = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(result.kind).toBe("envelope-error");
  });

  it("returns envelope-error when the body is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("<html>oops</html>", { headers: { "Content-Type": "text/html" } }),
    );
    const result = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(result.kind).toBe("envelope-error");
  });

  it("forwards parser failures as parse-error / version-not-supported", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(envelope({ x: "not a number" })));
    const parseFail = await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher });
    expect(parseFail.kind).toBe("parse-error");

    const futureFetcher = vi.fn().mockResolvedValue(buildResponse(envelope({ x: 1 })));
    const versionResult = await fetchEnvelope({
      url: "/api/x",
      parse: versionGuardParse(1, 999),
      fetcher: futureFetcher,
    });
    expect(versionResult.kind).toBe("version-not-supported");
  });

  it("passes the AbortSignal through to fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(buildResponse(envelope({ x: 1 })));
    const controller = new AbortController();
    await fetchEnvelope({ url: "/api/x", parse: okParse, fetcher, signal: controller.signal });
    expect(fetcher).toHaveBeenCalledWith("/api/x", { signal: controller.signal });
  });
});
