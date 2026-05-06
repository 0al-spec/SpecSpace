import type { ApiSpecNode } from "./types";
import "./RecentChangesOverlay.css";

const STATUS_COLORS: Record<string, string> = {
  idea: "#a0875a",
  stub: "#a0875a",
  outlined: "#7a7a7a",
  specified: "#4a7fa5",
  linked: "#4a7fa5",
  reviewed: "#4a8c5c",
  frozen: "#4a8c5c",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(delta / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(delta / 86_400_000);
  return `${days}d ago`;
}

interface RecentChangesOverlayProps {
  nodes: ApiSpecNode[];
  onSelect: (nodeId: string) => void;
  selectedNodeId?: string | null;
  limit?: number;
}

export default function RecentChangesOverlay({
  nodes,
  onSelect,
  selectedNodeId,
  limit = 25,
}: RecentChangesOverlayProps) {
  const sorted = [...nodes]
    .filter((n) => !!n.updated_at)
    .sort((a, b) => {
      const ta = new Date(a.updated_at!).getTime();
      const tb = new Date(b.updated_at!).getTime();
      return tb - ta;
    })
    .slice(0, limit);

  if (sorted.length === 0) {
    return (
      <div className="rc-panel">
        <div className="rc-empty">No updated_at timestamps available.</div>
      </div>
    );
  }

  return (
    <div className="rc-panel">
      <div className="rc-header">
        <span className="rc-title">Recently Updated</span>
        <span className="rc-count">{sorted.length} nodes</span>
      </div>
      <div className="rc-list">
        {sorted.map((node) => {
          const color = STATUS_COLORS[node.status] ?? "#888";
          const isSelected = node.node_id === selectedNodeId;
          return (
            <button
              key={node.node_id}
              className={`rc-item${isSelected ? " rc-item--selected" : ""}`}
              onClick={() => onSelect(node.node_id)}
              title={fmtDate(node.updated_at)}
            >
              <div className="rc-item-row">
                <span className="rc-item-id">{node.node_id}</span>
                <span className="rc-item-kind">{node.kind}</span>
                <span className="rc-item-status" style={{ color }}>{node.status}</span>
                <span className="rc-item-time">{fmtRelative(node.updated_at)}</span>
              </div>
              <div className="rc-item-title">{node.title}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
