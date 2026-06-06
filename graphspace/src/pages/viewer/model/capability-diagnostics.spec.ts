import { describe, expect, it } from "vitest";
import { describeCapabilityDiagnostics } from "./capability-diagnostics";
import type { SpecSpaceCapabilities } from "./use-specspace-capabilities";

const capabilities = (
  overrides: Partial<SpecSpaceCapabilities["diagnostics"]["hyperpromptCompile"]> = {},
): SpecSpaceCapabilities => ({
  providerKind: "file",
  capabilities: {
    spec_markdown_export: true,
    hyperprompt_compile: Boolean(overrides.available),
  },
  diagnostics: {
    specMarkdownExport: {
      available: true,
      status: "available",
      detail: "Readonly SpecGraph Markdown export is available.",
    },
    hyperpromptCompile: {
      available: false,
      status: "scratch_not_configured",
      detail: "Hyperprompt compile requires an explicit scratch workspace.",
      configuredBinary: "/opt/hyperprompt",
      resolvedBinary: "/opt/hyperprompt",
      resolutionSource: "configured",
      checkedPaths: ["/opt/hyperprompt"],
      scratchWorkspace: null,
      ...overrides,
    },
    agentPassportCli: {
      available: false,
      status: "binary_missing",
      detail: "Agent Passport CLI binary was not found.",
      configuredBinary: "/app/deps/agent-passport",
      resolvedBinary: "/app/deps/agent-passport",
      checkedPaths: ["/app/deps/agent-passport"],
    },
  },
});

describe("describeCapabilityDiagnostics", () => {
  it("keeps Markdown export available while Hyperprompt compile is disabled", () => {
    const rows = describeCapabilityDiagnostics({
      kind: "ok",
      data: capabilities(),
    });

    expect(rows.map((row) => [row.id, row.status, row.countLabel])).toEqual([
      ["spec-markdown-export", "available", "readonly"],
      ["hyperprompt-compile", "scratch_not_configured", "disabled"],
      ["agent-passport-cli", "binary_missing", "disabled"],
    ]);
  });

  it("marks Hyperprompt compile ready only when the backend capability is available", () => {
    const rows = describeCapabilityDiagnostics({
      kind: "ok",
      data: capabilities({
        available: true,
        status: "available",
        detail: "Hyperprompt compile is configured.",
        scratchWorkspace: "/tmp/specspace-hyperprompt",
      }),
    });

    expect(rows[1]).toMatchObject({
      id: "hyperprompt-compile",
      tone: "live",
      status: "available",
      countLabel: "ready",
    });
    expect(rows[1].detail).toContain("scratch /tmp/specspace-hyperprompt");
  });

  it("shows the bundled Agent Passport CLI when the backend reports it", () => {
    const rows = describeCapabilityDiagnostics({
      kind: "ok",
      data: {
        ...capabilities(),
        capabilities: {
          spec_markdown_export: true,
          hyperprompt_compile: false,
          agent_passport_cli: true,
        },
        diagnostics: {
          ...capabilities().diagnostics,
          agentPassportCli: {
            available: true,
            status: "available",
            detail: "Agent Passport validation CLI is bundled.",
            configuredBinary: "/app/deps/agent-passport",
            resolvedBinary: "/app/deps/agent-passport",
            checkedPaths: ["/app/deps/agent-passport"],
          },
        },
      },
    });

    expect(rows[2]).toMatchObject({
      id: "agent-passport-cli",
      label: "Agent Passport CLI",
      tone: "live",
      status: "available",
      countLabel: "ready",
    });
    expect(rows[2].detail).toContain("binary /app/deps/agent-passport");
  });

  it("surfaces capability endpoint failures as deployment diagnostics", () => {
    const rows = describeCapabilityDiagnostics({
      kind: "http-error",
      status: 503,
      statusText: "Service Unavailable",
    });

    expect(rows).toEqual([
      {
        id: "capabilities",
        label: "Capabilities",
        endpoint: "/api/v1/capabilities",
        tone: "fallback",
        status: "unavailable",
        countLabel: "diagnostics",
        detail: "HTTP 503 Service Unavailable",
      },
    ]);
  });
});
