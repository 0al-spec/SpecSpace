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

type SourceMode = "activity" | "nodes" | "runs";

interface RunEvent {
  run_id: string;
  ts: string;
  spec_id: string;
  title: string | null;
  run_kind: string | null;
  completion_status: string | null;
  duration_sec: number | null;
}

/** One entry from runs/spec_activity_feed.json — see SpecGraph
 *  docs/spec_activity_feed_viewer_contract.md for the canonical schema. */
interface ActivityEntry {
  event_id: string;
  event_type: string;
  spec_id: string;
  title: string;
  occurred_at: string;
  summary: string;
  source_kind: string;
  source_ref?: { sha?: string; short_sha?: string; subject?: string };
  source_paths?: string[];
  viewer?: { tone?: string; label?: string };
}

/** event_type → display tone color. Unknown types render neutral grey. */
const ACTIVITY_TONE_COLORS: Record<string, string> = {
  canonical_spec_updated: "#4a7fa5",        // node/spec accent
  trace_baseline_attached: "#6c4012",       // trace/evidence accent
  evidence_baseline_attached: "#6c4012",    // trace/evidence accent
  proposal_emitted: "#915a24",              // proposal accent
  implementation_work_emitted: "#4a8c5c",   // implementation/work accent
  review_feedback_applied: "#a06c5c",       // process/review accent
};

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

/** Shared singleton fetch — kept at module scope so StrictMode's double-mount
 *  triggers exactly one network request and both invocations get the same
 *  result. Reset to null after a failure or when `force` is set (live-mode
 *  refetches). */
let runsFetchPromise: Promise<RunEvent[]> | null = null;
function sharedRunsFetch(force = false): Promise<RunEvent[]> {
  if (force) runsFetchPromise = null;
  if (runsFetchPromise) return runsFetchPromise;
  runsFetchPromise = fetch("/api/recent-runs?limit=500")
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return Array.isArray(data?.events) ? (data.events as RunEvent[]) : [];
    })
    .catch((err) => {
      runsFetchPromise = null;
      throw err;
    });
  return runsFetchPromise;
}

/** Activity feed fetcher — same singleton pattern as runs. Returns null when
 *  the artifact is not built (HTTP 404), distinguishing "not available" from
 *  "request failed". */
type ActivityResult = { entries: ActivityEntry[]; mtime_iso?: string } | null;
let activityFetchPromise: Promise<ActivityResult> | null = null;
function sharedActivityFetch(force = false): Promise<ActivityResult> {
  if (force) activityFetchPromise = null;
  if (activityFetchPromise) return activityFetchPromise;
  activityFetchPromise = fetch("/api/spec-activity?limit=500")
    .then(async (r) => {
      if (r.status === 404) return null; // feed not built — Activity unavailable
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const env = await r.json();
      const entries = env?.data?.entries;
      return {
        entries: Array.isArray(entries) ? (entries as ActivityEntry[]) : [],
        mtime_iso: typeof env?.mtime_iso === "string" ? env.mtime_iso : undefined,
      };
    })
    .catch((err) => {
      activityFetchPromise = null;
      throw err;
    });
  return activityFetchPromise;
}

/** Status priority for sparkline cell color: failed beats progressed beats ok. */
const SPARK_PRIORITY: Record<string, number> = { failed: 3, progressed: 2, ok: 1 };
const SPARK_DAYS = 7;

interface SparklineProps {
  events: RunEvent[];
  /** Today's local-midnight timestamp (ms); passed in to avoid recomputing per row. */
  todayMs: number;
}

/** 7-day per-spec activity sparkline. Each cell = one calendar day; right = today. */
function Sparkline({ events, todayMs }: SparklineProps) {
  // Pick the worst-status event for each day, then render 7 cells.
  const cells: (string | null)[] = Array(SPARK_DAYS).fill(null);
  for (const ev of events) {
    if (!ev.completion_status) continue;
    const ts = new Date(ev.ts).getTime();
    const diffDays = Math.floor((todayMs - ts) / 86_400_000);
    if (diffDays < 0 || diffDays >= SPARK_DAYS) continue;
    const idx = SPARK_DAYS - 1 - diffDays;
    const cur = cells[idx];
    if (
      cur === null ||
      (SPARK_PRIORITY[ev.completion_status] ?? 0) > (SPARK_PRIORITY[cur] ?? 0)
    ) {
      cells[idx] = ev.completion_status;
    }
  }
  // Don't render if there's no activity in the window.
  if (cells.every((c) => c === null)) return null;

  const w = 56, h = 10, gap = 1;
  const cellW = (w - gap * (SPARK_DAYS - 1)) / SPARK_DAYS;
  return (
    <svg
      className="rc-sparkline"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      {cells.map((status, i) => {
        const x = i * (cellW + gap);
        const filled = status !== null;
        return (
          <rect
            key={i}
            x={x}
            y={1}
            width={cellW}
            height={h - 2}
            rx={1}
            fill={filled ? `var(--rc-spark-${status})` : "transparent"}
            stroke={filled ? "none" : "var(--line, #d4c4ac)"}
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
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
  /** Called when a row is clicked. `ts` is the event/update ISO timestamp,
   *  enabling the parent to focus a Timeline window around that moment. */
  onSelect: (nodeId: string, ts: string) => void;
  selectedNodeId?: string | null;
}

export default function RecentChangesOverlay({
  nodes,
  onSelect,
  selectedNodeId,
}: RecentChangesOverlayProps) {
  const [limit, setLimit] = useState<LimitOption>(DEFAULT_LIMIT);
  // Default starts as "nodes"; auto-switches to "activity" once we confirm the
  // SpecGraph activity feed is available. Once the user picks a mode manually,
  // we stop auto-switching (tracked via sourcePinnedRef).
  const [source, setSource] = useState<SourceMode>("nodes");
  const sourcePinnedRef = useRef(false);
  const setSourceManual = useCallback((s: SourceMode) => {
    sourcePinnedRef.current = true;
    setSource(s);
  }, []);
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState(false);

  // Runs feed state. Fetched once on mount: powers both the Runs source
  // view and the per-row sparklines in Nodes view, so a single round-trip
  // serves the whole panel.
  // Note: StrictMode-safe — guard via a module-level promise so React 18's
  // double-invocation of effects doesn't fire two requests, and the second
  // mount still gets the same data once it resolves.
  const [runs, setRuns] = useState<RunEvent[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  // Activity feed state. `null` = feed not built (artifact missing); the
  // Activity toggle stays disabled in that case and the panel falls back to
  // the existing Nodes/Runs modes.
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [activityAvailable, setActivityAvailable] = useState<boolean | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityMtime, setActivityMtime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    sharedRunsFetch()
      .then((evts) => {
        if (!cancelled) setRuns(evts);
      })
      .catch((err) => {
        if (cancelled) return;
        setRunsError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Activity feed: fetch once on mount, then auto-switch source to "activity"
  // if the feed is available AND the user hasn't manually picked a source yet.
  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    sharedActivityFetch()
      .then((res) => {
        if (cancelled) return;
        if (res === null) {
          setActivityAvailable(false);
          return;
        }
        setActivity(res.entries);
        setActivityMtime(res.mtime_iso ?? null);
        setActivityAvailable(true);
        if (!sourcePinnedRef.current) setSource("activity");
      })
      .catch((err) => {
        if (cancelled) return;
        setActivityError(String(err?.message ?? err));
        setActivityAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Live mode — subscribe to /api/runs-watch SSE; on each `change` event
  // schedule a debounced refetch of /api/recent-runs.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const refetch = () => {
      sharedRunsFetch(true)
        .then((evts) => {
          if (!cancelled) setRuns(evts);
        })
        .catch(() => { /* swallow — error state already covered by initial fetch */ });
      // The runs/ watch also fires when spec_activity_feed.json is rebuilt,
      // since it lives in runs/. Refetch the activity feed too.
      if (activityAvailable !== false) {
        sharedActivityFetch(true)
          .then((res) => {
            if (cancelled || res === null) return;
            setActivity(res.entries);
            setActivityMtime(res.mtime_iso ?? null);
          })
          .catch(() => { /* swallow */ });
      }
    };

    const es = new EventSource("/api/runs-watch");
    es.addEventListener("change", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refetch, 500);
    });
    es.onerror = () => {
      // Browser will reconnect automatically; nothing to do.
    };

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      es.close();
    };
  }, [live, activityAvailable]);

  // Index runs by spec_id for sparkline rendering. Each value is the
  // (already sorted desc) list of events touching that spec.
  const runsBySpec = useMemo(() => {
    const m = new Map<string, RunEvent[]>();
    if (!runs) return m;
    for (const r of runs) {
      const arr = m.get(r.spec_id);
      if (arr) arr.push(r);
      else m.set(r.spec_id, [r]);
    }
    return m;
  }, [runs]);

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

  // Activity branch: map ActivityEntry → DisplayItem, sorted by occurred_at desc.
  // Entries without a spec_id (e.g. graph-level review_feedback events) are
  // kept and shown with a synthesized id so they remain navigable in the list.
  const activityItems = useMemo<DisplayItem[]>(() => {
    if (!activity) return [];
    return [...activity]
      .filter((e) => typeof e.occurred_at === "string" && e.occurred_at)
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
      .map((e) => {
        const tone = ACTIVITY_TONE_COLORS[e.event_type] ?? "#6d6255";
        const label = e.viewer?.label ?? e.event_type.replace(/_/g, " ");
        return {
          key: e.event_id,
          primaryId: e.spec_id || "—",
          kind: e.event_type,
          status: label,
          statusColor: tone,
          title: e.title || e.summary || "(no title)",
          ts: e.occurred_at,
          // Empty spec_id means graph-level event — clicking still focuses
          // Recent close, but parent's navigateToSpec("") becomes a no-op.
          navigateId: e.spec_id || "",
        };
      });
  }, [activity]);

  const allItems =
    source === "activity" ? activityItems
    : source === "nodes" ? nodesItems
    : runsItems;
  const visible = limit === null ? allItems : allItems.slice(0, limit);
  const total = allItems.length;
  const showingCount = visible.length;

  // Local midnight as a single epoch — passed into every Sparkline so each
  // row doesn't recompute it.
  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

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
        <span
          className="rc-scope-hint"
          title={
            activityAvailable
              ? "Activity: SpecGraph normalized event feed " +
                "(canonical updates, trace/evidence baselines, proposals, " +
                "implementation work, review feedback).\n\n" +
                "Nodes: canonical YAML updated_at per spec.\n" +
                "Runs: supervisor refine events from runs/*.json."
              : "Shows canonical spec YAML updates (Nodes) and supervisor refine events (Runs).\n\n" +
                "Activity that does NOT touch the canonical YAML — trace/evidence baselines, " +
                "proposals, review feedback, etc. — will surface once SpecGraph publishes " +
                "runs/spec_activity_feed.json."
          }
        >
          ⓘ
        </span>
        <span className="rc-count">
          {showingCount === total
            ? `${total} ${source === "runs" ? "runs" : source === "activity" ? "events" : "nodes"}`
            : `${showingCount} of ${total}`}
        </span>
        <button
          className={`rc-live-btn${live ? " active" : ""}`}
          onClick={() => setLive((v) => !v)}
          title={live ? "Pause live updates" : "Stream live updates from runs/"}
        >
          {live ? "🔴 live" : "⏸ live"}
        </button>
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
            className={`rc-source-btn${source === "activity" ? " active" : ""}`}
            onClick={() => setSourceManual("activity")}
            disabled={activityAvailable === false}
            title={
              activityAvailable === false
                ? "Activity feed not built. Run `make spec-activity` in SpecGraph."
                : activityMtime
                  ? `SpecGraph activity feed — generated ${fmtRelative(activityMtime)}`
                  : "SpecGraph activity feed (canonical normalized events)"
            }
          >
            Activity
          </button>
          <button
            className={`rc-source-btn${source === "nodes" ? " active" : ""}`}
            onClick={() => setSourceManual("nodes")}
          >
            Nodes
          </button>
          <button
            className={`rc-source-btn${source === "runs" ? " active" : ""}`}
            onClick={() => setSourceManual("runs")}
          >
            Runs
          </button>
        </div>
      </div>

      {source === "activity" && activityLoading && activity === null ? (
        <div className="rc-empty">Loading activity feed…</div>
      ) : source === "activity" && activityError ? (
        <div className="rc-empty">Failed to load activity feed: {activityError}</div>
      ) : source === "runs" && runsLoading && runs === null ? (
        <div className="rc-empty">Loading runs…</div>
      ) : source === "runs" && runsError ? (
        <div className="rc-empty">Failed to load runs: {runsError}</div>
      ) : allItems.length === 0 ? (
        <div className="rc-empty">
          {source === "activity"
            ? "No activity events found."
            : source === "runs"
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
                    onClick={() => onSelect(it.navigateId, it.ts)}
                    title={fmtDate(it.ts)}
                  >
                    <div className="rc-item-row">
                      <span className="rc-item-id">{it.primaryId}</span>
                      <span className="rc-item-kind">{it.kind}</span>
                      <span className="rc-item-status" style={{ color: it.statusColor }}>{it.status}</span>
                      {source === "nodes" && (
                        <Sparkline events={runsBySpec.get(it.primaryId) ?? []} todayMs={todayMs} />
                      )}
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
