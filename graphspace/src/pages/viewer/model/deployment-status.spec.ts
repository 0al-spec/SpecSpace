import { describe, expect, it } from "vitest";
import {
  describeDeploymentStatus,
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
  it("shows UI and API source commits in the compact status label", () => {
    const state = describeDeploymentStatus(ui(), {
      kind: "ok",
      deployment: deployment(),
      provider: "http",
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
    })).toBe(false);
  });

  it("keeps runs-watch for filesystem-backed local providers", () => {
    expect(shouldUseRunsWatch({
      kind: "ok",
      deployment: deployment(),
      provider: "file",
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

function ui(): DeploymentInfo {
  return deployment({ apiImageRef: null, uiImageRef: null });
}
