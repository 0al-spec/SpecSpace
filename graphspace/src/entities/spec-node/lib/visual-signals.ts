import type { SpecNode } from "../model/types";

export type SpecNodeStatusTone = "linked" | "reviewed" | "frozen" | "unknown";
export type SpecNodeMaturityTone = "weak" | "medium" | "strong" | "unknown";

const STATUS_TONES: Record<string, SpecNodeStatusTone> = {
  linked: "linked",
  reviewed: "reviewed",
  frozen: "frozen",
};

export function getSpecNodeStatusTone(
  status: SpecNode["status"] | null | undefined,
): SpecNodeStatusTone {
  if (!status) return "unknown";
  return STATUS_TONES[status.trim().toLowerCase()] ?? "unknown";
}

export function getSpecNodeMaturityPercent(
  maturity: SpecNode["maturity"],
): number | null {
  if (typeof maturity !== "number" || !Number.isFinite(maturity)) return null;
  return Math.min(Math.max(Math.round(maturity * 100), 0), 100);
}

export function getSpecNodeMaturityTone(
  maturity: SpecNode["maturity"],
): SpecNodeMaturityTone {
  const percent = getSpecNodeMaturityPercent(maturity);
  if (percent === null) return "unknown";
  if (percent < 50) return "weak";
  if (percent < 80) return "medium";
  return "strong";
}

export function formatSpecNodeMaturity(maturity: SpecNode["maturity"]): string | null {
  const percent = getSpecNodeMaturityPercent(maturity);
  return percent === null ? null : `${percent}%`;
}

export function formatSpecNodeGapLabel(count: SpecNode["gap_count"]): string {
  return count === 1 ? "1 gap" : `${count} gaps`;
}
