import { useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type WorkspaceState = {
  data: JsonRecord | null;
  error: string | null;
  loading: boolean;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "n/a"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function titleFromId(workspaceId: string): string {
  return workspaceId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (["ready", "passed", "published", "completed", "merged"].includes(normalized)) {
    return "is-ready";
  }
  if (["dry_run", "dry-run", "pending", "missing"].includes(normalized)) {
    return "is-pending";
  }
  if (["blocked", "failed", "error", "invalid"].includes(normalized)) {
    return "is-blocked";
  }
  return "is-neutral";
}

function shortRef(ref: unknown): string {
  const value = asString(ref, "");
  if (!value) {
    return "n/a";
  }
  const parts = value.split("/");
  return parts.slice(-2).join("/");
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pws-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pws-status ${statusClass(status)}`}>{status}</span>;
}

function FlowRow({
  detail,
  label,
  status,
}: {
  detail?: string;
  label: string;
  status: string;
}) {
  return (
    <li className="pws-flow-row">
      <span className={`pws-flow-dot ${statusClass(status)}`} />
      <span className="pws-flow-main">
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </span>
      <StatusPill status={status} />
    </li>
  );
}

function ProductWorkspacePage({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<WorkspaceState>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    fetch(`/api/v1/idea-to-spec-workspace?workspace=${encodeURIComponent(workspaceId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<JsonRecord>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "unknown error",
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const view = useMemo(() => {
    const data = asRecord(state.data);
    const workspace = asRecord(data.workspace);
    const summary = asRecord(data.summary);
    const workflow = asRecord(data.workflow);
    const candidateGraph = asRecord(data.candidate_graph);
    const graphSummary = asRecord(candidateGraph.summary);
    const activeFrame = asRecord(candidateGraph.active_frame);
    const repairSession = asRecord(data.repair_session);
    const repairImpact = asRecord(repairSession.readiness_impact);
    const approvalReadiness = asRecord(data.approval_readiness);
    const controlledPromotion = asRecord(data.controlled_promotion);
    const platformRequest = asRecord(controlledPromotion.platform_request);
    const promotionExecution = asRecord(controlledPromotion.product_promotion_execution);
    const approvalExecution = asRecord(controlledPromotion.candidate_approval_execution);
    const reviewStatus = asRecord(controlledPromotion.review_status);
    const readModel = asRecord(controlledPromotion.read_model_publication);
    const nodes = asList(candidateGraph.nodes).map(asRecord);
    const workflowItems = asList(workflow.items).map(asRecord);
    const paths = asList(platformRequest.commit_paths).filter(
      (item): item is string => typeof item === "string",
    );

    return {
      activeFrame,
      approvalExecution,
      approvalReadiness,
      candidateGraph,
      controlledPromotion,
      graphSummary,
      nodes,
      paths,
      platformRequest,
      promotionExecution,
      readModel,
      repairImpact,
      repairSession,
      reviewStatus,
      summary,
      workflow,
      workflowItems,
      workspace,
    };
  }, [state.data]);

  const displayName = asString(view.workspace.display_name, titleFromId(workspaceId));
  const workspaceStatus = asString(view.workspace.review_state, "workspace");
  const graphSource = asString(view.candidateGraph.source_mode, "candidate");
  const approvalReady =
    asBoolean(view.summary.approval_ready) ||
    asBoolean(view.approvalReadiness.ready_for_candidate_approval);
  const candidateApprovalStatus = approvalReady ? "ready" : "blocked";
  const promotionStatus = asString(view.promotionExecution.status, "missing");
  const reviewStatus = asString(view.reviewStatus.status, "missing");
  const readModelStatus = asString(view.readModel.status, "missing");
  const workflowStatus = asString(view.workflow.status, asString(view.summary.status, "unknown"));

  useEffect(() => {
    document.title = `${displayName} - SpecSpace`;
  }, [displayName]);

  if (state.loading) {
    return (
      <main className="pws-page">
        <div className="pws-center-state">Loading product workspace</div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="pws-page">
        <div className="pws-center-state is-error">
          Product workspace unavailable: {state.error}
        </div>
      </main>
    );
  }

  return (
    <main className="pws-page">
      <header className="pws-header">
        <div>
          <p className="pws-eyebrow">Product workspace</p>
          <h1>{displayName}</h1>
          <div className="pws-subtitle">
            <span>{asString(view.workspace.public_route, `/${workspaceId}`)}</span>
            <span>{asString(view.workspace.workflow_lane, "product_idea_to_spec")}</span>
            <span>{asString(view.workspace.target_repository_role, "product_spec_workspace")}</span>
          </div>
        </div>
        <div className="pws-header-status">
          <StatusPill status={workspaceStatus} />
          <StatusPill status={workflowStatus} />
        </div>
      </header>

      <section className="pws-kpi-strip" aria-label="Workspace metrics">
        <Kpi label="candidate nodes" value={asNumber(view.graphSummary.node_count)} />
        <Kpi label="open gaps" value={asNumber(view.graphSummary.gap_count)} />
        <Kpi label="ontology resolved" value={asNumber(view.summary.resolved_ontology_gap_count)} />
        <Kpi label="candidate repairs" value={asNumber(view.summary.rerun_removed_gap_count)} />
        <Kpi label="promotion paths" value={asNumber(view.summary.promotion_path_count)} />
      </section>

      <section className="pws-grid">
        <article className="pws-panel pws-panel-wide">
          <div className="pws-panel-head">
            <div>
              <p>Candidate graph</p>
              <h2>{graphSource}</h2>
            </div>
            <StatusPill status={asString(view.candidateGraph.source_mode, "available")} />
          </div>
          <div className="pws-card-metrics">
            <Kpi label="requirements" value={asNumber(view.graphSummary.requirement_count)} />
            <Kpi
              label="acceptance criteria"
              value={asNumber(view.graphSummary.acceptance_criteria_count)}
            />
            <Kpi label="edges" value={asNumber(view.graphSummary.edge_count)} />
          </div>
          <div className="pws-frame">
            <span>{asList(view.activeFrame.domain_refs).map(String).join(", ") || "domain n/a"}</span>
            <span>
              {asList(view.activeFrame.context_refs).map(String).join(", ") || "context n/a"}
            </span>
            <span>
              {asList(view.activeFrame.ontology_layer_refs).map(String).join(", ") ||
                "layers n/a"}
            </span>
          </div>
          <div className="pws-node-list">
            {view.nodes.slice(0, 8).map((node) => (
              <div className="pws-node" key={asString(node.id)}>
                <strong>{asString(node.title)}</strong>
                <span>{asString(node.kind)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="pws-panel">
          <div className="pws-panel-head">
            <div>
              <p>Approval readiness</p>
              <h2>{candidateApprovalStatus}</h2>
            </div>
            <StatusPill status={candidateApprovalStatus} />
          </div>
          <ul className="pws-flow-list">
            <FlowRow
              label="Repair session"
              status={asString(view.repairSession.status, "ready")}
              detail={shortRef(view.repairSession.source_ref)}
            />
            <FlowRow
              label="Candidate approval"
              status={candidateApprovalStatus}
              detail={
                asBoolean(view.summary.repair_session_ready_for_candidate_approval)
                  ? "repair session ready"
                  : "repair session blocked"
              }
            />
            <FlowRow
              label="Approval materialization"
              status={asString(view.approvalExecution.status, "missing")}
              detail={shortRef(view.approvalExecution.output_ref)}
            />
          </ul>
        </article>

        <article className="pws-panel">
          <div className="pws-panel-head">
            <div>
              <p>Controlled promotion</p>
              <h2>{promotionStatus}</h2>
            </div>
            <StatusPill status={promotionStatus} />
          </div>
          <ul className="pws-flow-list">
            <FlowRow
              label="Promotion request"
              status={asBoolean(view.platformRequest.ok) ? "ready" : "missing"}
              detail={`${view.paths.length} paths`}
            />
            <FlowRow
              label="Git Service execution"
              status={promotionStatus}
              detail={asString(view.promotionExecution.next_action, "review handoff")}
            />
            <FlowRow label="Review status" status={reviewStatus} detail="post-review check" />
            <FlowRow label="Read model" status={readModelStatus} detail="public publication" />
          </ul>
        </article>

        <article className="pws-panel pws-panel-wide">
          <div className="pws-panel-head">
            <div>
              <p>Promotion paths</p>
              <h2>{view.paths.length} files</h2>
            </div>
            <StatusPill status={view.paths.length ? "ready" : "missing"} />
          </div>
          <div className="pws-path-grid">
            {view.paths.slice(0, 12).map((path) => (
              <code key={path}>{path}</code>
            ))}
          </div>
        </article>

        <article className="pws-panel">
          <div className="pws-panel-head">
            <div>
              <p>Workflow lane</p>
              <h2>{asString(view.workflow.stage, "unknown")}</h2>
            </div>
            <StatusPill status={workflowStatus} />
          </div>
          <ul className="pws-flow-list pws-flow-list-compact">
            {view.workflowItems.slice(-7).map((item) => (
              <FlowRow
                key={asString(item.id)}
                label={asString(item.label)}
                status={asString(item.status)}
                detail={asString(item.detail, "")}
              />
            ))}
          </ul>
        </article>

        <article className="pws-panel">
          <div className="pws-panel-head">
            <div>
              <p>Repair impact</p>
              <h2>{asNumber(view.summary.rerun_removed_gap_count)} removed</h2>
            </div>
            <StatusPill status={asNumber(view.graphSummary.gap_count) === 0 ? "ready" : "blocked"} />
          </div>
          <div className="pws-card-metrics">
            <Kpi label="ontology gaps" value={asNumber(view.summary.unresolved_ontology_gap_count)} />
            <Kpi label="open blockers" value={asList(view.repairImpact.open_blockers).length} />
          </div>
        </article>
      </section>
    </main>
  );
}

export default ProductWorkspacePage;
