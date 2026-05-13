export type SpecPMLifecycleBadgeTone = "draft" | "ready" | "blocked" | "unknown";

export type SpecPMLifecycleBadge = {
  packageKey: string;
  status: string;
  tone: SpecPMLifecycleBadgeTone;
};
