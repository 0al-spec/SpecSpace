export type AgentSurfaceTone = "ok" | "warn" | "danger" | "neutral";

export function agentSurfaceTone(value: string | null | undefined): AgentSurfaceTone {
  const status = (value ?? "").toLowerCase();
  if (
    status.includes("critical") ||
    status.includes("high") ||
    status.includes("severe")
  ) {
    return "danger";
  }
  if (
    status.includes("medium") ||
    status.includes("low") ||
    status.includes("missing") ||
    status.includes("unknown") ||
    status.includes("not_") ||
    status.includes("blocked")
  ) {
    return "warn";
  }
  if (
    status.includes("ready") ||
    status.includes("available") ||
    status.includes("verified")
  ) {
    return "ok";
  }
  return "neutral";
}
