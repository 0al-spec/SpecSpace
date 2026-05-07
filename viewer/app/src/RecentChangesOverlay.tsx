import { useState, useMemo } from "react";
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

/** `null` = show all */
type LimitOption = 25 | 50 | 100 | null;
const LIMIT_OPTIONS: LimitOption[] = [25, 50, 100, null];
const DEFAULT_LIMIT: LimitOption = 25;

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
}

export default function RecentChangesOverlay({
  nodes,
  onSelect,
  selectedNodeId,
}: RecentChangesOverlayProps) {
  const [limit, setLimit] = useState<LimitOption>(DEFAULT_LIMIT);

  // Sort once per nodes change; slicing is cheap and depends on `limit`.
  const sortedAll = useMemo(
    () =>
      [...nodes]
        .filter((n) => !!n.updated_at)
        .sort((a, b) => {
          const ta = new Date(a.updated_at!).getTime();
          const tb = new Date(b.updated_at!).getTime();
          return tb - ta;
        }),
    [nodes],
  );

  const visible = limit === null ? sortedAll : sortedAll.slice(0, limit);
  const total = sortedAll.length;
  const showingCount = visible.length;

  return (
    <div className="rc-panel">
      <div className="rc-header">
        <span className="rc-title">Recently Updated</span>
        <span className="rc-count">
          {showingCount === total
            ? `${total} nodes`
            : `${showingCount} of ${total}`}
        </span>
      </div>

      {sortedAll.length === 0 ? (
        <div className="rc-empty">No updated_at timestamps available.</div>
      ) : (
        <>
          <div className="rc-list">
            {visible.map((node) => {
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

          <div className="rc-footer">
            <span className="rc-footer-label">Show:</span>
            <div className="rc-limit-group">
              {LIMIT_OPTIONS.map((opt) => {
                const active = opt === limit;
                const label = opt === null ? "All" : String(opt);
                // Disable values that exceed total — no point offering "100" if there are 30 entries.
                const disabled = opt !== null && opt > total && limit !== opt;
                return (
                  <button
                    key={label}
                    className={`rc-limit-btn${active ? " active" : ""}`}
                    onClick={() => setLimit(opt)}
                    disabled={disabled}
                    title={disabled ? `Only ${total} entries available` : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
