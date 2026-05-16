import { describeHttpErrorDetail, type LiveArtifactState } from "./live-artifacts";

export type LiveStatus = { caption: string; emptyMessage: string };

export function describeLive(
  state: LiveArtifactState,
  noun: { items: string; itemSingular: string; emptyLive: string },
): LiveStatus {
  switch (state.kind) {
    case "idle":
    case "loading":
      return { caption: `loading… · sample fallback`, emptyMessage: "loading" };
    case "ok":
      return { caption: `live`, emptyMessage: noun.emptyLive };
    case "http-error":
      return {
        caption: `live · HTTP ${state.status} · sample fallback`,
        emptyMessage: describeHttpErrorDetail(state),
      };
    case "network-error":
      return {
        caption: "live · backend unreachable · sample fallback",
        emptyMessage: "network error",
      };
    case "envelope-error":
      return { caption: "live · bad envelope · sample fallback", emptyMessage: state.reason };
    case "version-not-supported":
      return {
        caption: `live · schema_version ${state.schema_version} unsupported · sample fallback`,
        emptyMessage: `schema_version ${state.schema_version} > max ${state.max_supported}`,
      };
    case "wrong-artifact-kind":
      return {
        caption: "live · wrong artifact_kind · sample fallback",
        emptyMessage: `expected ${state.expected}`,
      };
    case "parse-error":
      return { caption: "live · parse error · sample fallback", emptyMessage: "schema validation failed" };
    case "invariant-violation":
      return { caption: "live · invariant violation · sample fallback", emptyMessage: state.message };
  }

  void noun.items;
  void noun.itemSingular;
}
