import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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

/** Run completion_status → display color */
const RUN_STATUS_COLORS: Record<string, string> = {
  ok: "#4a8c5c",
  progressed: "#4a7fa5",
  failed: "#b54131",
};

/** `null` = show all */
type LimitOption = 25 | 50 | 100 | null;
const LIMIT_OPTIONS: LimitOption[] = [25, 50, 100, null];
const DEFAULT_LIMIT: LimitOption = 25;

type SourceMode = "nodes" | "runs";

interface RunEvent {
  run_id: string;
  ts: string;
  spec_id: string;
  title: string | null;
  run_kind: string | null;
  completion_status: string | null;
  duration_sec: number | null;
}

/** Common shape for rendering — both Nodes & Runs sources collapse to this. */
interface DisplayItem {
  key: string;
  primaryId: string;
  kind: string;
  status: string;
  statusColor: string;
  title: string;
  ts: string;
  navigateId: string;
  isFailed?: boolean;
}

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

type Bucket = "Today" | "Yesterday" | "This week" | "Older";

/** Bucket relative to local-day boundaries (handles DST/midnight cleanly). */
function bucketFor(iso: string): Bucket {
  const ts = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000; // 7-day window incl. today
  const t = ts.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";
  if (t >= startOfWeek) return "This week";
  return "Older";
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
  const [source, setSource] = useState<SourceMode>("nodes");
  const [copied, setCopied] = useState(false);

  // Runs feed state — fetched lazily when source flips to "runs".
  const [runs, setRuns] = useState<RunEvent[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const runsFetchedRef = useRef(false);

  useEffect(() => {
    if (source !== "runs" || runsFetchedRef.current) return;
    runsFetchedRef.current = true;
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    fetch("/api/recent-runs?limit=500")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRuns(Array.isArray(data?.events) ? data.events : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setRunsError(String(err?.message ?? err));
        runsFetchedRef.current = false; // allow retry after a transient failure
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => { cancelled = true; };
  }, [source]);

  // Nodes branch: map ApiSpecNode → DisplayItem (skip nodes without updated_at)
  const nodesItems = useMemo<DisplayItem[]>(
    () =>
      [...nodes]
        .filter((n) => !!n.updated_at)
        .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
        .map((n) => ({
          key: n.node_id,
          primaryId: n.node_id,
          kind: n.kind,
          status: n.status,
          statusColor: STATUS_COLORS[n.status] ?? "#888",
          title: n.title,
          ts: n.updated_at!,
          navigateId: n.node_id,
        })),
    [nodes],
  );

  // Runs branch: map RunEvent → DisplayItem; one node may appear multiple times.
  const runsItems = useMemo<DisplayItem[]>(() => {
    if (!runs) return [];
    return [...runs]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .map((r) => {
        const status = r.completion_status ?? "unknown";
        return {
          key: r.run_id,
          primaryId: r.spec_id,
          kind: r.run_kind ?? "run",
          status,
          statusColor: RUN_STATUS_COLORS[status] ?? "#888",
          title: r.title ?? "",
          ts: r.ts,
          navigateId: r.spec_id,
          isFailed: status === "failed",
        };
      });
  }, [runs]);

  const allItems = source === "nodes" ? nodesItems : runsItems;
  const visible = limit === null ? allItems : allItems.slice(0, limit);
  const total = allItems.length;
  const showingCount = visible.length;

  const handleCopy = useCallback(() => {
    const md = visible
      .map((it) => `- **${it.primaryId}** *${it.kind}* — ${it.title || "(no title)"} (${fmtRelative(it.ts)})`)
      .join("\n");
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [visible]);

  // Custom overlay scrollbar — track {top, height, visible} as percentages
  const listRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0, height: 0, visible: false,
  });

  const recomputeThumb = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setThumb((t) => (t.visible ? { ...t, visible: false } : t));
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const heightPct = Math.max(8, ratio * 100);
    const topPct = (scrollTop / scrollHeight) * 100;
    setThumb({ top: topPct, height: heightPct, visible: true });
  }, []);

  useEffect(() => {
    recomputeThumb();
  }, [recomputeThumb, visible.length, source]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recomputeThumb);
    ro.observe(el);
    return () => ro.disconnect();
  }, [recomputeThumb]);

  return (
    <div className="rc-panel">
      <div className="rc-header">
        <span className="rc-title">Recently Updated</span>
        <span className="rc-count">
          {showingCount === total
            ? `${total} ${source === "runs" ? "runs" : "nodes"}`
            : `${showingCount} of ${total}`}
        </span>
        <button
          className="rc-copy-btn"
          onClick={handleCopy}
          disabled={visible.length === 0}
          title="Copy as Markdown"
        >
          {copied ? "✓ copied" : "📋 MD"}
        </button>
      </div>

      <div className="rc-source-row">
        <div className="rc-source-group">
          <button
            className={`rc-source-btn${source === "nodes" ? " active" : ""}`}
            onClick={() => setSource("nodes")}
          >
            Nodes
          </button>
          <button
            className={`rc-source-btn${source === "runs" ? " active" : ""}`}
            onClick={() => setSource("runs")}
          >
            Runs
          </button>
        </div>
      </div>

      {source === "runs" && runsLoading && runs === null ? (
        <div className="rc-empty">Loading runs…</div>
      ) : source === "runs" && runsError ? (
        <div className="rc-empty">Failed to load runs: {runsError}</div>
      ) : allItems.length === 0 ? (
        <div className="rc-empty">
          {source === "runs"
            ? "No run events found."
            : "No updated_at timestamps available."}
        </div>
      ) : (
        <>
          <div className="rc-list-wrap">
          {thumb.visible && (
            <div
              className="rc-scrollbar-thumb"
              style={{ top: `${thumb.top}%`, height: `${thumb.height}%` }}
            />
          )}
          <div className="rc-list" ref={listRef} onScroll={recomputeThumb}>
            {(() => {
              // Group consecutive entries by date bucket; emit a single header
              // before each run.
              const out: React.ReactNode[] = [];
              let prevBucket: Bucket | null = null;
              const counts: Record<Bucket, number> = {
                Today: 0, Yesterday: 0, "This week": 0, Older: 0,
              };
              for (const it of visible) counts[bucketFor(it.ts)]++;

              for (const it of visible) {
                const bucket = bucketFor(it.ts);
                if (bucket !== prevBucket) {
                  out.push(
                    <div key={`hdr-${bucket}`} className="rc-group">
                      <span className="rc-group-label">{bucket}</span>
                      <span className="rc-group-count">{counts[bucket]}</span>
                    </div>,
                  );
                  prevBucket = bucket;
                }
                const isSelected = it.navigateId === selectedNodeId;
                const cls = `rc-item${isSelected ? " rc-item--selected" : ""}${it.isFailed ? " rc-item--failed" : ""}`;
                out.push(
                  <button
                    key={it.key}
                    className={cls}
                    onClick={() => onSelect(it.navigateId)}
                    title={fmtDate(it.ts)}
                  >
                    <div className="rc-item-row">
                      <span className="rc-item-id">{it.primaryId}</span>
                      <span className="rc-item-kind">{it.kind}</span>
                      <span className="rc-item-status" style={{ color: it.statusColor }}>{it.status}</span>
                      <span className="rc-item-time">{fmtRelative(it.ts)}</span>
                    </div>
                    <div className="rc-item-title">{it.title || "(no title)"}</div>
                  </button>,
                );
              }
              return out;
            })()}
          </div>
          </div>

          <div className="rc-footer">
            <span className="rc-footer-label">Show:</span>
            <div className="rc-limit-group">
              {LIMIT_OPTIONS.map((opt) => {
                const active = opt === limit;
                const label = opt === null ? "All" : String(opt);
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
