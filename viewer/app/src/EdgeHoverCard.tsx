import type { EdgeVisualState } from "./useSpecGraphData";
import "./EdgeHoverCard.css";

interface EdgeHoverCardProps {
  kind: string;
  visualState?: EdgeVisualState;
  sourceId: string;
  targetId: string;
  sourceTitle?: string;
  targetTitle?: string;
  x: number;
  y: number;
}

const KIND_LABELS: Record<string, string> = {
  refines: "refines",
  depends_on: "depends_on",
  relates_to: "relates_to",
};

const VISUAL_STATE_LABELS: Partial<Record<EdgeVisualState, string>> = {
  required_satisfied: "satisfied",
  required_pending: "pending",
  active_blocker: "blocked",
  not_available: "not available",
  broken_reference: "broken",
  historical_lineage: "historical",
};

const VISUAL_STATE_REASONS: Partial<Record<EdgeVisualState, string>> = {
  required_satisfied: "target linked / reviewed / frozen",
  required_pending: "target in progress",
  active_blocker: "gate blocked",
  not_available: "availability contract says not satisfied",
  broken_reference: "target not found",
};

export default function EdgeHoverCard({
  kind,
  visualState,
  sourceId,
  targetId,
  sourceTitle,
  targetTitle,
  x,
  y,
}: EdgeHoverCardProps) {
  const stateLabel = visualState ? (VISUAL_STATE_LABELS[visualState] ?? visualState) : null;
  const stateReason = visualState ? VISUAL_STATE_REASONS[visualState] : null;

  return (
    <div className="edge-hover-card" style={{ left: x, top: y }}>
      {/* Source node card */}
      <div className="edge-hover-node-card">
        <div className="edge-hover-node-id">{sourceId}</div>
        {sourceTitle && <div className="edge-hover-node-title">{sourceTitle}</div>}
      </div>

      {/* Center: kind badge + optional state badge */}
      <div className="edge-hover-center">
        <span className="spec-node-kind-badge">{KIND_LABELS[kind] ?? kind}</span>
        {stateLabel && (
          <span className={`spec-node-status-badge edge-hover-state edge-hover-state--${visualState}`}>
            {stateLabel}
          </span>
        )}
        {stateReason && <div className="edge-hover-reason">{stateReason}</div>}
      </div>

      {/* Target node card */}
      <div className="edge-hover-node-card">
        <div className="edge-hover-node-id">{targetId}</div>
        {targetTitle && <div className="edge-hover-node-title">{targetTitle}</div>}
      </div>
    </div>
  );
}
