import { useEffect, useState } from "react";

export type HyperpromptCompileDiagnostic = {
  available: boolean;
  status: string;
  detail: string;
  configuredBinary: string | null;
  resolvedBinary: string | null;
  resolutionSource: string | null;
  checkedPaths: readonly string[];
  scratchWorkspace: string | null;
};

export type AgentPassportCliDiagnostic = {
  available: boolean;
  status: string;
  detail: string;
  configuredBinary: string | null;
  resolvedBinary: string | null;
  checkedPaths: readonly string[];
};

export type SpecMarkdownExportDiagnostic = {
  available: boolean;
  status: string;
  detail: string;
};

export type SpecSpaceCapabilities = {
  providerKind: string | null;
  capabilities: Record<string, boolean>;
  diagnostics: {
    specMarkdownExport: SpecMarkdownExportDiagnostic;
    hyperpromptCompile: HyperpromptCompileDiagnostic;
    agentPassportCli: AgentPassportCliDiagnostic;
  };
};

export type UseSpecSpaceCapabilitiesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: SpecSpaceCapabilities }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "response-error"; reason: string; raw: unknown }
  | { kind: "parse-error"; reason: string; raw: unknown };

type Options = {
  url?: string;
  fetcher?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanMap(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "boolean") result[key] = raw;
  }
  return result;
}

function parseMarkdownDiagnostic(value: unknown): SpecMarkdownExportDiagnostic | null {
  if (!isRecord(value) || typeof value.available !== "boolean") return null;
  return {
    available: value.available,
    status: optionalString(value.status) ?? (value.available ? "available" : "unavailable"),
    detail: optionalString(value.detail) ?? "No Markdown export diagnostic detail.",
  };
}

function parseHyperpromptDiagnostic(value: unknown): HyperpromptCompileDiagnostic | null {
  if (!isRecord(value) || typeof value.available !== "boolean") return null;
  return {
    available: value.available,
    status: optionalString(value.status) ?? (value.available ? "available" : "unavailable"),
    detail: optionalString(value.detail) ?? "No Hyperprompt compile diagnostic detail.",
    configuredBinary: optionalString(value.configured_binary),
    resolvedBinary: optionalString(value.resolved_binary),
    resolutionSource: optionalString(value.resolution_source),
    checkedPaths: Array.isArray(value.checked_paths)
      ? value.checked_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [],
    scratchWorkspace: optionalString(value.scratch_workspace),
  };
}

function parseAgentPassportCliDiagnostic(value: unknown): AgentPassportCliDiagnostic {
  if (!isRecord(value) || typeof value.available !== "boolean") {
    return {
      available: false,
      status: "not_reported",
      detail: "Agent Passport CLI diagnostic is not reported by this deployment.",
      configuredBinary: null,
      resolvedBinary: null,
      checkedPaths: [],
    };
  }
  return {
    available: value.available,
    status: optionalString(value.status) ?? (value.available ? "available" : "unavailable"),
    detail: optionalString(value.detail) ?? "No Agent Passport CLI diagnostic detail.",
    configuredBinary: optionalString(value.configured_binary),
    resolvedBinary: optionalString(value.resolved_binary),
    checkedPaths: Array.isArray(value.checked_paths)
      ? value.checked_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [],
  };
}

function parseCapabilities(raw: unknown): SpecSpaceCapabilities | { reason: string; raw: unknown } {
  if (!isRecord(raw)) return { reason: "capabilities response is not an object", raw };
  const capabilities = booleanMap(raw.capabilities);
  if (!capabilities) return { reason: "capabilities field is not an object", raw };
  const diagnostics = isRecord(raw.diagnostics) ? raw.diagnostics : {};
  const specMarkdownExport = parseMarkdownDiagnostic(diagnostics.spec_markdown_export);
  const hyperpromptCompile = parseHyperpromptDiagnostic(diagnostics.hyperprompt_compile);
  const agentPassportCli = parseAgentPassportCliDiagnostic(diagnostics.agent_passport_cli);
  if (!specMarkdownExport || !hyperpromptCompile) {
    return { reason: "capability diagnostics are missing or malformed", raw };
  }
  const provider = isRecord(raw.provider) ? raw.provider : null;
  return {
    providerKind: optionalString(provider?.kind),
    capabilities,
    diagnostics: {
      specMarkdownExport,
      hyperpromptCompile,
      agentPassportCli,
    },
  };
}

export function useSpecSpaceCapabilities(
  options: Options = {},
): UseSpecSpaceCapabilitiesState {
  const { url = "/api/v1/capabilities", fetcher = fetch } = options;
  const [state, setState] = useState<UseSpecSpaceCapabilitiesState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // Non-JSON proxy failures are still useful as HTTP status diagnostics.
          }
          if (!cancelled) {
            setState({
              kind: "http-error",
              status: response.status,
              statusText: response.statusText,
              body,
            });
          }
          return;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (!cancelled) {
            setState({
              kind: "response-error",
              reason: "response was not valid JSON",
              raw: error,
            });
          }
          return;
        }

        const parsed = parseCapabilities(payload);
        if (!cancelled) {
          setState(
            "reason" in parsed
              ? { kind: "parse-error", reason: parsed.reason, raw: parsed.raw }
              : { kind: "ok", data: parsed },
          );
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, url]);

  return state;
}
