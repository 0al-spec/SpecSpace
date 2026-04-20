import type { SpecLensMode, SpecOverlayEntry } from "./types";

export interface LensStyle {
  /** Inline style for node border / accent color */
  borderColor?: string;
  /** Inline style for node background tint */
  background?: string;
  /** Optional label placed under the title */
  badge?: { text: string; color: string; bg: string };
}

/* ── Color palette (sourced from theme.css) ─────────────────────────── */
const C = {
  red:        "#b54131",  // --broken-line
  amber:      "#915a24",  // --accent
  greenLine:  "#5d8b58",  // --root-line
  green:      "#d7efd4",  // --root
  blueLine:   "#4e689b",  // --branch-line
  blue:       "#dbe6ff",  // --branch
  amberSoft:  "#f5e0c7",  // --accent-soft
  redSoft:    "#f8d7d1",  // --broken
  muted:      "#b89f7f",  // --line-strong
  mutedSoft:  "#ece3d4",  // --bg
};

/* ── Health lens ─────────────────────────────────────────────────────── */
function healthStyle(e: SpecOverlayEntry): LensStyle {
  const h = e.health;
  if (!h) return {};
  const gate = h.gate_state ?? "none";
  const signals = h.signals ?? [];

  if (gate === "split_required") {
    return {
      borderColor: C.red,
      background: C.redSoft,
      badge: { text: "SPLIT", color: "#fff", bg: C.red },
    };
  }
  if (gate === "review_pending") {
    return {
      borderColor: C.amber,
      background: C.amberSoft,
      badge: { text: "REVIEW", color: "#fff", bg: C.amber },
    };
  }
  if (signals.length > 0) {
    return {
      borderColor: C.amber,
      background: C.amberSoft,
      badge: { text: `${signals.length} signal${signals.length > 1 ? "s" : ""}`, color: C.amber, bg: "#fff" },
    };
  }
  return { borderColor: C.greenLine };
}

/* ── Implementation lens ─────────────────────────────────────────────── */
function implementationStyle(e: SpecOverlayEntry): LensStyle {
  const im = e.implementation;
  if (!im) return {};
  const state = im.implementation_state ?? "unclaimed";
  const freshness = im.freshness;

  if (state === "verified") {
    return {
      borderColor: C.greenLine,
      background: C.green,
      badge: { text: "VERIFIED", color: "#fff", bg: C.greenLine },
    };
  }
  if (state === "in_progress") {
    const freshTag = freshness === "dirty_worktree" ? " · DIRTY" : "";
    return {
      borderColor: C.blueLine,
      background: C.blue,
      badge: { text: `IN PROGRESS${freshTag}`, color: "#fff", bg: C.blueLine },
    };
  }
  // unclaimed
  return {
    borderColor: C.muted,
    badge: { text: "UNCLAIMED", color: C.muted, bg: "#fff" },
  };
}

/* ── Evidence lens ───────────────────────────────────────────────────── */
function evidenceStyle(e: SpecOverlayEntry): LensStyle {
  const ev = e.evidence;
  if (!ev) return {};
  const cs = ev.chain_status ?? "untracked";

  if (cs === "chain_complete") {
    return {
      borderColor: C.greenLine,
      background: C.green,
      badge: { text: "CHAIN OK", color: "#fff", bg: C.greenLine },
    };
  }
  if (cs === "observation_backed") {
    return {
      borderColor: C.blueLine,
      background: C.blue,
      badge: { text: "OBSERVED", color: "#fff", bg: C.blueLine },
    };
  }
  if (cs === "partial") {
    return {
      borderColor: C.amber,
      background: C.amberSoft,
      badge: { text: "PARTIAL", color: "#fff", bg: C.amber },
    };
  }
  // untracked
  return {
    borderColor: C.muted,
    badge: { text: "UNTRACKED", color: C.muted, bg: "#fff" },
  };
}

/**
 * Compute visual style for a spec node under the active lens.
 * Returns {} for lens="none" or if the spec has no overlay entry.
 */
export function lensStyleFor(
  specId: string,
  lens: SpecLensMode,
  overlays: Record<string, SpecOverlayEntry>,
): LensStyle {
  if (lens === "none") return {};
  const entry = overlays[specId];
  if (!entry) return {};
  switch (lens) {
    case "health":         return healthStyle(entry);
    case "implementation": return implementationStyle(entry);
    case "evidence":       return evidenceStyle(entry);
    default:               return {};
  }
}

/**
 * Human-readable description of a lens (for tooltips / titles).
 */
export const LENS_LABELS: Record<SpecLensMode, { short: string; title: string }> = {
  none:           { short: "None",     title: "No overlay — default node styling" },
  health:         { short: "Health",   title: "Structural pressure: gate state and graph-health signals" },
  implementation: { short: "Impl",     title: "Implementation state and freshness from spec trace" },
  evidence:       { short: "Evidence", title: "Evidence chain coverage per spec" },
};
