import type { SpecNode } from "../model/types";

export type SpecNodeStatusTone = "linked" | "reviewed" | "frozen" | "unknown";
export type SpecNodeMaturityTone = "weak" | "medium" | "strong" | "unknown";

const STATUS_TONES: Record<string, SpecNodeStatusTone> = {
  linked: "linked",
  reviewed: "reviewed",
  frozen: "frozen",
};

function normalizedMaturityRatio(maturity: SpecNode["maturity"]): number | null {
  if (typeof maturity !== "number" || !Number.isFinite(maturity)) return null;
  return Math.min(Math.max(maturity, 0), 1);
}

export function getSpecNodeStatusTone(
  status: SpecNode["status"] | null | undefined,
): SpecNodeStatusTone {
  if (!status) return "unknown";
  return STATUS_TONES[status.trim().toLowerCase()] ?? "unknown";
}

export function getSpecNodeMaturityPercent(
  maturity: SpecNode["maturity"],
): number | null {
  const ratio = normalizedMaturityRatio(maturity);
  return ratio === null ? null : Math.round(ratio * 100);
}

export function getSpecNodeMaturityTone(
  maturity: SpecNode["maturity"],
): SpecNodeMaturityTone {
  const ratio = normalizedMaturityRatio(maturity);
  if (ratio === null) return "unknown";
  if (ratio < 0.5) return "weak";
  if (ratio < 0.8) return "medium";
  return "strong";
}

export function formatSpecNodeMaturity(maturity: SpecNode["maturity"]): string | null {
  const percent = getSpecNodeMaturityPercent(maturity);
  return percent === null ? null : `${percent}%`;
}

export function formatSpecNodeGapLabel(count: SpecNode["gap_count"]): string {
  return count === 1 ? "1 gap" : `${count} gaps`;
}
