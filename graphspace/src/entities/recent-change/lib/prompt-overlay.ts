import type {
  PromptOverlayProvenance,
  PromptOverlayStatus,
} from "@/shared/spec-graph-contract";

export type PromptOverlayTone = "neutral" | "active" | "muted" | "danger";

export type PromptOverlayDetail = {
  label: string;
  value: string;
  title?: string;
  tone?: "danger";
};

export function toneForPromptOverlay(status: PromptOverlayStatus): PromptOverlayTone {
  switch (status) {
    case "enabled":
      return "active";
    case "legacy_unknown":
      return "muted";
    case "unsafe":
      return "danger";
    case "core":
      return "neutral";
  }
}

export function shortHash(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 12 ? `${trimmed.slice(0, 7)}...` : trimmed;
}

export function promptOverlayReasonLabel(reason: string | undefined): string | null {
  switch (reason) {
    case "missing_exact_run_link":
      return "No exact run link";
    case "legacy_run_without_provenance":
      return "Legacy run without provenance";
    default:
      return reason ? reason.replaceAll("_", " ") : null;
  }
}

export function buildPromptOverlayDetails(
  provenance: PromptOverlayProvenance,
): PromptOverlayDetail[] {
  const details: PromptOverlayDetail[] = [
    { label: "Status", value: provenance.status },
    { label: "Source", value: provenance.source_kind },
  ];
  if (provenance.run_id) {
    details.push({ label: "Run ID", value: provenance.run_id });
  }
  const reason = promptOverlayReasonLabel(provenance.reason);
  if (reason) details.push({ label: "Reason", value: reason });
  if (provenance.prompt_profile_id) {
    details.push({ label: "Profile", value: provenance.prompt_profile_id });
  }
  if (provenance.prompt_overlay_authority) {
    details.push({ label: "Authority", value: provenance.prompt_overlay_authority });
  }
  if (provenance.prompt_extension_path) {
    details.push({ label: "Extension", value: provenance.prompt_extension_path });
  }
  const promptHash = shortHash(provenance.prompt_extension_sha256);
  if (promptHash) {
    details.push({
      label: "Prompt SHA",
      value: promptHash,
      title: provenance.prompt_extension_sha256,
    });
  }
  if (provenance.policy_reference?.artifact_path) {
    details.push({ label: "Policy", value: provenance.policy_reference.artifact_path });
  }
  const policyHash = shortHash(provenance.policy_reference?.artifact_sha256);
  if (policyHash) {
    details.push({
      label: "Policy SHA",
      value: policyHash,
      title: provenance.policy_reference?.artifact_sha256,
    });
  }
  if (provenance.core_prompt_overridden !== undefined) {
    details.push({
      label: "Core overridden",
      value:
        provenance.core_prompt_overridden === null
          ? "unknown"
          : String(provenance.core_prompt_overridden),
      tone: provenance.core_prompt_overridden === false ? undefined : "danger",
    });
  }
  if (provenance.unsafe_reasons?.length) {
    details.push({
      label: "Unsafe reasons",
      value: provenance.unsafe_reasons.join(", "),
      tone: "danger",
    });
  }
  return details;
}
