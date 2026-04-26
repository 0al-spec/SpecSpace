import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarPlus, faRotate, faAngleUp } from "@fortawesome/free-solid-svg-icons";
import type { ApiSpecNode } from "./types";
import "./SpecHoverCard.css";

interface SpecHoverCardProps {
  node: ApiSpecNode;
  /** Bounding rect of the hovered ReactFlow node wrapper (screen coords) */
  rect: DOMRect;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const CARD_W = 300;
const SPACE_ABOVE_THRESHOLD = 220; // px — if less space above, flip below

export default function SpecHoverCard({ node, rect }: SpecHoverCardProps) {
  const showAbove = rect.top > SPACE_ABOVE_THRESHOLD;

  // Clamp horizontally so card doesn't overflow viewport
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - CARD_W - 8);

  const posStyle: React.CSSProperties = showAbove
    ? { bottom: window.innerHeight - rect.top + 8 }
    : { top: rect.bottom + 8 };

  const hasGaps = node.gap_count > 0;
  const hasDeps = node.depends_on.length + node.refines.length + node.relates_to.length > 0;
  const hasMeta = node.acceptance_count > 0 || node.decisions_count > 0 || hasGaps || hasDeps;

  return (
    <div
      className={`spec-hover-card spec-hover-card--${showAbove ? "above" : "below"}`}
      style={{ left, ...posStyle }}
    >
      {/* ID + title */}
      <div className="spec-hover-card-id">{node.node_id}</div>
      <div className="spec-hover-card-title">{node.title}</div>

      {/* Kind + status + presence badges — UI Kit rectangular */}
      <div className="spec-hover-card-badges">
        <span className="spec-node-kind-badge">{node.kind}</span>
        <span className={`spec-node-status-badge status-${node.status}`}>{node.status}</span>
        {node.presence_state === "historical" && (
          <span className="spec-node-status-badge spec-node-historical-badge" title="Lineage artifact — superseded">
            historical
          </span>
        )}
      </div>

      {/* Maturity bar */}
      {node.maturity !== null && (
        <div className="spec-node-maturity spec-hover-card-maturity">
          <div className="spec-node-maturity-label">maturity {Math.round(node.maturity * 100)}%</div>
          <div className="spec-node-maturity-track">
            <div className="spec-node-maturity-fill" style={{ width: `${node.maturity * 100}%` }} />
          </div>
        </div>
      )}

      {hasMeta && <div className="spec-hover-card-divider" />}

      {/* Acceptance + decisions */}
      {(node.acceptance_count > 0 || node.decisions_count > 0) && (
        <div className="spec-hover-card-row">
          {node.acceptance_count > 0 && (
            <span className="spec-hover-card-stat">{node.acceptance_count} criteria</span>
          )}
          {node.decisions_count > 0 && (
            <span className="spec-hover-card-stat">{node.decisions_count} decisions</span>
          )}
        </div>
      )}

      {/* Gaps breakdown */}
      {hasGaps && (
        <div className="spec-hover-card-row">
          {node.evidence_gap > 0 && (
            <span className="spec-hover-card-gap">⚠ {node.evidence_gap} evidence</span>
          )}
          {node.input_gap > 0 && (
            <span className="spec-hover-card-gap">⚠ {node.input_gap} input</span>
          )}
          {node.execution_gap > 0 && (
            <span className="spec-hover-card-gap">⚠ not run</span>
          )}
        </div>
      )}

      {/* Relationships */}
      {hasDeps && (
        <div className="spec-hover-card-row spec-hover-card-rels">
          {node.depends_on.length > 0 && (
            <span>→ {node.depends_on.length} dep{node.depends_on.length !== 1 ? "s" : ""}</span>
          )}
          {node.refines.length > 0 && (
            <span><FontAwesomeIcon icon={faAngleUp} /> {node.refines.length} refines</span>
          )}
          {node.relates_to.length > 0 && (
            <span>~ {node.relates_to.length} relates</span>
          )}
        </div>
      )}

      {/* Dates */}
      {(node.created_at || node.updated_at) && (
        <div className="spec-hover-card-dates">
          {node.created_at && (
            <span>
              <FontAwesomeIcon icon={faCalendarPlus} className="spec-hover-card-date-icon" />
              {fmtDate(node.created_at)}
            </span>
          )}
          {node.updated_at && (
            <span>
              <FontAwesomeIcon icon={faRotate} className="spec-hover-card-date-icon" />
              {fmtDate(node.updated_at)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
