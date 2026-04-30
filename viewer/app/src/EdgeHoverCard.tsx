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
  broken_reference: "broken",
  historical_lineage: "historical",
};

const VISUAL_STATE_REASONS: Partial<Record<EdgeVisualState, string>> = {
  required_satisfied: "target is linked, reviewed, or frozen",
  required_pending: "target is still in progress",
  active_blocker: "gate is blocked",
  broken_reference: "target spec not found",
};

const CARD_W = 260;

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
  const left = Math.min(Math.max(8, x - CARD_W / 2), window.innerWidth - CARD_W - 8);
  const rawTop = y + 14;
  const top = rawTop + 100 > window.innerHeight ? y - 110 : rawTop;

  const stateLabel = visualState ? (VISUAL_STATE_LABELS[visualState] ?? visualState) : null;

  return (
    <div className="edge-hover-card" style={{ left, top }}>
      <div className="edge-hover-card-route">
        <span className="edge-hover-card-node-id">{sourceId}</span>
        <span className="edge-hover-card-arrow">→</span>
        <span className="edge-hover-card-node-id">{targetId}</span>
      </div>

      {(sourceTitle || targetTitle) && (
        <div className="edge-hover-card-titles">
          {sourceTitle && <span className="edge-hover-card-title-text">{sourceTitle}</span>}
          {sourceTitle && targetTitle && <span className="edge-hover-card-arrow-sm">→</span>}
          {targetTitle && <span className="edge-hover-card-title-text">{targetTitle}</span>}
        </div>
      )}

      <div className="edge-hover-card-badges">
        <span className="spec-node-kind-badge">{KIND_LABELS[kind] ?? kind}</span>
        {stateLabel && (
          <span className={`spec-node-status-badge edge-hover-card-state edge-hover-card-state--${visualState}`}>
            {stateLabel}
          </span>
        )}
      </div>

      {visualState && VISUAL_STATE_REASONS[visualState] && (
        <div className="edge-hover-card-reason">{VISUAL_STATE_REASONS[visualState]}</div>
      )}
    </div>
  );
}
