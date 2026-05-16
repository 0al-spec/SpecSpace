import { useEffect, useState } from "react";

export type DeploymentInfo = {
  version: string;
  commit: string | null;
  createdAt: string | null;
  apiImageRef: string | null;
  uiImageRef: string | null;
};

export type ApiDeploymentState =
  | { kind: "loading" }
  | { kind: "ok"; deployment: DeploymentInfo; provider: string | null }
  | { kind: "http-error"; status: number; statusText: string }
  | { kind: "network-error"; error: unknown }
  | { kind: "invalid"; reason: string };

export type DeploymentStatus = {
  label: string;
  title: string;
};

type Options = {
  url?: string;
  fetcher?: typeof fetch;
};

const FALLBACK_VERSION = "0.0.1";

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDeploymentInfo = (raw: unknown): DeploymentInfo => {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    version: normalizeText(record.version) ?? FALLBACK_VERSION,
    commit: normalizeText(record.commit),
    createdAt: normalizeText(record.created_at),
    apiImageRef: normalizeText(record.api_image_ref),
    uiImageRef: normalizeText(record.ui_image_ref),
  };
};

export const uiDeploymentInfo: DeploymentInfo = {
  version: import.meta.env.VITE_SPECSPACE_VERSION || FALLBACK_VERSION,
  commit: normalizeText(import.meta.env.VITE_SPECSPACE_RELEASE_COMMIT),
  createdAt: normalizeText(import.meta.env.VITE_SPECSPACE_RELEASE_CREATED_AT),
  apiImageRef: null,
  uiImageRef: null,
};

export function useApiDeploymentStatus(options: Options = {}): ApiDeploymentState {
  const { url = "/api/v1/health", fetcher = fetch } = options;
  const [state, setState] = useState<ApiDeploymentState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetcher(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setState({
              kind: "http-error",
              status: response.status,
              statusText: response.statusText,
            });
          }
          return;
        }

        const body: unknown = await response.json();
        if (!body || typeof body !== "object") {
          if (!cancelled) setState({ kind: "invalid", reason: "health response is not an object" });
          return;
        }

        const record = body as Record<string, unknown>;
        if (!cancelled) {
          setState({
            kind: "ok",
            deployment: normalizeDeploymentInfo(record.deployment),
            provider: normalizeText(record.provider),
          });
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

function shortCommit(commit: string | null): string {
  if (!commit) return "dev";
  return commit.length > 7 ? commit.slice(0, 7) : commit;
}

function formatDeployment(info: DeploymentInfo): string {
  return `${info.version}+${shortCommit(info.commit)}`;
}

function apiLabel(state: ApiDeploymentState): string {
  switch (state.kind) {
    case "ok":
      return `API ${formatDeployment(state.deployment)}`;
    case "loading":
      return "API loading";
    case "http-error":
      return `API HTTP ${state.status}`;
    case "network-error":
      return "API network-error";
    case "invalid":
      return "API invalid";
  }
}

function describeInfo(label: string, info: DeploymentInfo): string {
  return [
    `${label} version: ${info.version}`,
    `commit: ${info.commit ?? "not embedded"}`,
    `created_at: ${info.createdAt ?? "not embedded"}`,
    info.apiImageRef ? `api_image_ref: ${info.apiImageRef}` : null,
    info.uiImageRef ? `ui_image_ref: ${info.uiImageRef}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function describeApiState(state: ApiDeploymentState): string {
  switch (state.kind) {
    case "ok":
      return [
        describeInfo("API", state.deployment),
        `provider: ${state.provider ?? "unknown"}`,
      ].join("\n");
    case "loading":
      return "API deployment: loading /api/v1/health";
    case "http-error":
      return `API deployment: HTTP ${state.status} ${state.statusText}`;
    case "network-error":
      return "API deployment: backend unreachable";
    case "invalid":
      return `API deployment: ${state.reason}`;
  }
}

export function describeDeploymentStatus(
  ui: DeploymentInfo,
  api: ApiDeploymentState,
): DeploymentStatus {
  return {
    label: `UI ${formatDeployment(ui)} · ${apiLabel(api)}`,
    title: [describeInfo("UI", ui), describeApiState(api)].join("\n\n"),
  };
}
