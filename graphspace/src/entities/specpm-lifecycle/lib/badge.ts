import type { SpecPMLifecyclePackage } from "@/shared/specpm-lifecycle-contract";
import type { SpecPMLifecycleBadge, SpecPMLifecycleBadgeTone } from "../model/types";

const STATUS_TONE: Record<string, SpecPMLifecycleBadgeTone> = {
  draft_preview_only: "draft",
  draft_visible: "draft",
  draft_reference: "draft",
  draft_materialized: "draft",
  draft_visible_only: "draft",
  ready_for_review: "ready",
  ready_for_handoff: "ready",
  materialized_for_review: "ready",
  ready_for_lane: "ready",
  blocked_by_consumer_gap: "blocked",
  blocked_by_preview_gap: "blocked",
  blocked_by_checkout_gap: "blocked",
  blocked_by_consumer_identity: "blocked",
  blocked_by_handoff_gap: "blocked",
  blocked_by_bundle_gap: "blocked",
  blocked_by_import_gap: "blocked",
  invalid_export_contract: "blocked",
  invalid_handoff_contract: "blocked",
  invalid_import_contract: "blocked",
};

const STAGE_ORDER = [
  "import_handoff",
  "import",
  "materialization",
  "handoff",
  "export",
] as const;

const TONE_WEIGHT: Record<SpecPMLifecycleBadgeTone, number> = {
  blocked: 3,
  ready: 2,
  draft: 1,
  unknown: 0,
};

function statusTone(status: string | null | undefined): SpecPMLifecycleBadgeTone {
  if (!status) return "unknown";
  return STATUS_TONE[status] ?? "unknown";
}

export function getSpecPMLifecycleBadgeTone(
  status: string | null | undefined,
): SpecPMLifecycleBadgeTone {
  return statusTone(status);
}

function packageBadge(pkg: SpecPMLifecyclePackage): SpecPMLifecycleBadge | null {
  const candidates = STAGE_ORDER.flatMap((key) => {
    const status = pkg[key]?.status;
    return status ? [{ status, tone: statusTone(status) }] : [];
  });
  if (candidates.length === 0) return null;

  const selected = candidates.reduce((best, candidate) => {
    const toneDelta = TONE_WEIGHT[candidate.tone] - TONE_WEIGHT[best.tone];
    return toneDelta > 0 ? candidate : best;
  });

  return {
    packageKey: pkg.package_key,
    status: selected.status,
    tone: selected.tone,
  };
}

function packageSpecIds(pkg: SpecPMLifecyclePackage): string[] {
  return [
    ...new Set([
      ...pkg.source_spec_ids,
      ...(pkg.root_spec_id ? [pkg.root_spec_id] : []),
    ]),
  ];
}

function strongerBadge(
  current: SpecPMLifecycleBadge | undefined,
  next: SpecPMLifecycleBadge,
): SpecPMLifecycleBadge {
  if (!current) return next;
  return TONE_WEIGHT[next.tone] > TONE_WEIGHT[current.tone] ? next : current;
}

export function buildSpecPMLifecycleBadgesByNode(
  packages: readonly SpecPMLifecyclePackage[],
): Map<string, SpecPMLifecycleBadge> {
  const badges = new Map<string, SpecPMLifecycleBadge>();

  for (const pkg of packages) {
    const badge = packageBadge(pkg);
    if (!badge) continue;

    for (const nodeId of packageSpecIds(pkg)) {
      badges.set(nodeId, strongerBadge(badges.get(nodeId), badge));
    }
  }

  return badges;
}
