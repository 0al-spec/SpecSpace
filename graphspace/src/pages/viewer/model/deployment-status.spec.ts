import { describe, expect, it } from "vitest";
import {
  apiDeploymentStateFromHealth,
  apiHealthRequestInit,
  describeDeploymentStatus,
  operatorAuthenticationRequired,
  operatorSessionHref,
  shouldUseLocalSpecPMLifecycle,
  shouldUseRunsWatch,
  type ApiDeploymentState,
  type DeploymentInfo,
} from "./deployment-status";

const deployment = (overrides: Partial<DeploymentInfo> = {}): DeploymentInfo => ({
  version: "0.0.1",
  commit: "c05f17df6bd3ae338f98a4694561d640bcfda6d1",
  createdAt: "2026-05-16T16:16:38Z",
  apiImageRef: null,
  uiImageRef: null,
  ...overrides,
});

describe("describeDeploymentStatus", () => {
  it("bypasses browser caches for operator access health", () => {
    const controller = new AbortController();

    expect(apiHealthRequestInit(controller.signal)).toEqual({
      signal: controller.signal,
      cache: "no-store",
    });
  });

  it("shows UI and API source commits in the compact status label", () => {
    const state = describeDeploymentStatus(ui(), {
      kind: "ok",
      deployment: deployment(),
      provider: "http",
      operatorAccess: { enabled: false, authenticated: false },
    });

    expect(state.label).toBe("UI 0.0.1+c05f17d · API 0.0.1+c05f17d");
  });

  it("keeps image refs in the tooltip so deployment digests are inspectable", () => {
    const api: ApiDeploymentState = {
      kind: "ok",
      deployment: deployment({
        apiImageRef: "ghcr.io/0al-spec/specspace-api@sha256:" + "1".repeat(64),
        uiImageRef: "ghcr.io/0al-spec/specspace-ui@sha256:" + "2".repeat(64),
      }),
      provider: "http",
      operatorAccess: { enabled: false, authenticated: false },
    };

    const state = describeDeploymentStatus(ui(), api);

    expect(state.title).toContain("api_image_ref: ghcr.io/0al-spec/specspace-api@sha256:");
    expect(state.title).toContain("ui_image_ref: ghcr.io/0al-spec/specspace-ui@sha256:");
    expect(state.title).toContain("provider: http");
  });

  it("makes backend health failures visible separately from live artifact failures", () => {
    const state = describeDeploymentStatus(ui(), {
      kind: "http-error",
      status: 502,
      statusText: "Bad Gateway",
    });

    expect(state.label).toBe("UI 0.0.1+c05f17d · API HTTP 502");
    expect(state.title).toContain("API deployment: HTTP 502 Bad Gateway");
  });
});

describe("shouldUseRunsWatch", () => {
  it("disables runs-watch for static HTTP artifact providers", () => {
    expect(shouldUseRunsWatch({
      kind: "ok",
      deployment: deployment(),
      provider: "http",
      operatorAccess: { enabled: false, authenticated: false },
    })).toBe(false);
  });

  it("keeps runs-watch for filesystem-backed local providers", () => {
    expect(shouldUseRunsWatch({
      kind: "ok",
      deployment: deployment(),
      provider: "file",
      operatorAccess: { enabled: false, authenticated: false },
    })).toBe(true);
  });

  it("waits for health before opening the SSE endpoint", () => {
    expect(shouldUseRunsWatch({ kind: "loading" })).toBe(false);
  });

  it("keeps runs-watch available when health fails transiently", () => {
    expect(shouldUseRunsWatch({
      kind: "http-error",
      status: 502,
      statusText: "Bad Gateway",
    })).toBe(true);
    expect(shouldUseRunsWatch({
      kind: "network-error",
      error: new TypeError("Failed to fetch"),
    })).toBe(true);
    expect(shouldUseRunsWatch({
      kind: "invalid",
      reason: "bad health envelope",
    })).toBe(true);
  });
});

describe("shouldUseLocalSpecPMLifecycle", () => {
  it("disables local lifecycle fetches for static HTTP artifact providers", () => {
    expect(shouldUseLocalSpecPMLifecycle({
      kind: "ok",
      deployment: deployment(),
      provider: "http",
      operatorAccess: { enabled: false, authenticated: false },
    })).toBe(false);
  });

  it("enables local lifecycle fetches for filesystem-backed providers", () => {
    expect(shouldUseLocalSpecPMLifecycle({
      kind: "ok",
      deployment: deployment(),
      provider: "file",
      operatorAccess: { enabled: false, authenticated: false },
    })).toBe(true);
  });

  it("waits for health before deciding lifecycle availability", () => {
    expect(shouldUseLocalSpecPMLifecycle({ kind: "loading" })).toBe(false);
    expect(shouldUseLocalSpecPMLifecycle({
      kind: "network-error",
      error: new TypeError("Failed to fetch"),
    })).toBe(false);
  });
});

describe("operator access", () => {
  it("parses the backend health access-control projection", () => {
    expect(apiDeploymentStateFromHealth({
      provider: "file",
      deployment: { version: "1.2.3" },
      operator_access_control: {
        enabled: true,
        operator_authenticated: false,
      },
    })).toEqual({
      kind: "ok",
      deployment: {
        version: "1.2.3",
        commit: null,
        createdAt: null,
        apiImageRef: null,
        uiImageRef: null,
      },
      provider: "file",
      operatorAccess: { enabled: true, authenticated: false },
    });
  });

  it("requires authentication only when the backend enables it without a session", () => {
    expect(operatorAuthenticationRequired({
      kind: "ok",
      deployment: deployment(),
      provider: "file",
      operatorAccess: { enabled: true, authenticated: false },
    })).toBe(true);
    expect(operatorAuthenticationRequired({
      kind: "ok",
      deployment: deployment(),
      provider: "file",
      operatorAccess: { enabled: true, authenticated: true },
    })).toBe(false);
  });

  it("encodes the complete local route for the backend login redirect", () => {
    expect(operatorSessionHref("/pantry?view=demo#repair")).toBe(
      "/api/v1/operator-session?return_to=%2Fpantry%3Fview%3Ddemo%23repair",
    );
  });
});

function ui(): DeploymentInfo {
  return deployment({ apiImageRef: null, uiImageRef: null });
}
