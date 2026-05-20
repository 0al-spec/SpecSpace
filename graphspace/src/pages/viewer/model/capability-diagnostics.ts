import type { ArtifactDiagnostic } from "./live-artifacts";
import type { UseSpecSpaceCapabilitiesState } from "./use-specspace-capabilities";

const endpoint = "/api/v1/capabilities";

function errorDetail(state: Exclude<UseSpecSpaceCapabilitiesState, { kind: "ok" | "idle" | "loading" }>): string {
  switch (state.kind) {
    case "http-error":
      return `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
    case "network-error":
      return "Backend is unreachable.";
    case "response-error":
      return state.reason;
    case "parse-error":
      return state.reason;
  }
}

function fallbackRow(
  state: Exclude<UseSpecSpaceCapabilitiesState, { kind: "ok" }>,
): ArtifactDiagnostic {
  if (state.kind === "idle" || state.kind === "loading") {
    return {
      id: "capabilities",
      label: "Capabilities",
      endpoint,
      tone: "loading",
      status: "loading",
      countLabel: "checking",
      detail: "Loading deployment capability diagnostics.",
    };
  }

  return {
    id: "capabilities",
    label: "Capabilities",
    endpoint,
    tone: "fallback",
    status: "unavailable",
    countLabel: "diagnostics",
    detail: errorDetail(state),
  };
}

export function describeCapabilityDiagnostics(
  state: UseSpecSpaceCapabilitiesState,
): ArtifactDiagnostic[] {
  if (state.kind !== "ok") return [fallbackRow(state)];

  const markdown = state.data.diagnostics.specMarkdownExport;
  const hyperprompt = state.data.diagnostics.hyperpromptCompile;
  return [
    {
      id: "spec-markdown-export",
      label: "Markdown export",
      endpoint,
      tone: markdown.available ? "live" : "empty",
      status: markdown.status,
      countLabel: markdown.available ? "readonly" : "disabled",
      detail: markdown.detail,
    },
    {
      id: "hyperprompt-compile",
      label: "Hyperprompt compile",
      endpoint,
      tone: hyperprompt.available ? "live" : "empty",
      status: hyperprompt.status,
      countLabel: hyperprompt.available ? "ready" : "disabled",
      detail: [
        hyperprompt.detail,
        hyperprompt.resolvedBinary ? `binary ${hyperprompt.resolvedBinary}` : null,
        hyperprompt.scratchWorkspace ? `scratch ${hyperprompt.scratchWorkspace}` : null,
      ].filter(Boolean).join("; "),
    },
  ];
}
