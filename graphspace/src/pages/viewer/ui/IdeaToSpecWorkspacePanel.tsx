import { useEffect, useMemo, useState } from "react";
import { buildIdeaToSpecIntakeDraft } from "../model/idea-to-spec-intake-draft";
import type {
  IdeaToSpecActiveFrame,
  IdeaToSpecAcceptedAnswer,
  IdeaToSpecCandidateNode,
  IdeaToSpecClarificationRequest,
  IdeaToSpecGitServiceOperation,
  IdeaToSpecMaterializedFile,
  IdeaToSpecOntologyDecision,
  IdeaToSpecRepairAction,
  IdeaToSpecRepairSessionBlocker,
  IdeaToSpecRepairSessionStage,
  IdeaToSpecResolvedOntologyGap,
  IdeaToSpecWorkflow,
  IdeaToSpecWorkspace,
  UseIdeaToSpecWorkspaceState,
} from "../model/use-idea-to-spec-workspace";
import {
  useIdeaToSpecRepairDrafts,
  type IdeaToSpecRepairDraft,
  type IdeaToSpecRepairDraftInput,
  type UseIdeaToSpecRepairDraftsState,
} from "../model/use-idea-to-spec-repair-drafts";
import { describeHttpErrorDetail } from "../model/live-artifacts";
import styles from "./OntologySemanticReviewPanel.module.css";

type Props = {
  state: UseIdeaToSpecWorkspaceState;
  repairDraftsUrl?: string;
};

function errorDetail(
  state: Exclude<UseIdeaToSpecWorkspaceState, { kind: "ok" | "idle" | "loading" }>,
): string {
  switch (state.kind) {
    case "http-error":
      return describeHttpErrorDetail(state);
    case "network-error":
      return "Idea-to-spec workspace endpoint is unreachable from the browser.";
    case "response-error":
    case "parse-error":
      return state.reason;
  }
}

function compact(value: string | null | undefined, fallback = "unknown"): string {
  return value && value.length > 0 ? value : fallback;
}

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function joined(values: readonly string[], fallback = "none"): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function metricValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return boolText(value);
  return "n/a";
}

export function IdeaToSpecWorkspacePanel({ state, repairDraftsUrl }: Props) {
  const repairDrafts = useIdeaToSpecRepairDrafts({
    url: repairDraftsUrl,
    enabled: state.kind === "ok",
  });

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status
          label="Loading idea-to-spec workspace"
          detail="Reading /api/v1/idea-to-spec-workspace"
        />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Idea-to-spec workspace">
        <Status label="Idea-to-spec workspace unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;
  const frame = data.candidateGraph.activeFrame.project
    ? data.candidateGraph.activeFrame
    : data.intake.activeFrame;

  return (
    <section className={styles.panel} aria-label="Idea-to-spec workspace">
      <div className={styles.summary}>
        <Metric label="Artifacts" value={data.summary.availableArtifactCount} />
        <Metric label="Nodes" value={data.summary.candidateNodeCount} />
        <Metric label="Edges" value={data.summary.candidateEdgeCount} />
        <Metric label="Seed gaps" value={data.summary.ontologySeedGapCount} />
        <Metric label="Bindings" value={data.summary.ontologySeedBindingCount} />
        <Metric label="Findings" value={data.summary.preSibFindingCount} />
        <Metric label="Repairs" value={data.summary.repairActionCount} />
        <Metric label="Requests" value={data.summary.clarificationRequestCount} />
        <Metric label="Decisions" value={data.summary.ontologyDecisionCount} />
        <Metric label="Resolved" value={data.summary.resolvedOntologyGapCount} />
        <Metric label="Context" value={data.summary.repairContextRequiredCount} />
        <Metric label="Specs" value={data.summary.materializedFileCount} />
        <Metric label="Promote" value={data.summary.promotionPathCount} />
        <Metric label="Gate" value={data.summary.promotionGateBlockerCount} />
        <Metric label="Git ops" value={data.summary.gitServiceOperationCount} />
        <Metric label="Missing" value={data.summary.missingArtifactCount} />
      </div>

      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceMain}>
          <span className={styles.kicker}>Idea-to-Spec Workspace</span>
          <span className={styles.surfaceTitle}>
            {compact(frame.project, "no project")} · pre-SIB · readonly
          </span>
        </div>
        <div className={styles.statusGroup}>
          <Pill value={compact(data.workspace.reviewState, "no active candidate")} />
          <Pill value={data.summary.status} />
          <Pill value={compact(data.preSib.readiness.reviewState, "no pre-SIB")} />
          <Pill value={compact(data.repairLoop.readiness.reviewState, "no repair")} />
          <Pill
            value={compact(
              data.materialization.readiness.reviewState,
              "no materialization",
            )}
          />
          <Pill
            value={compact(
              data.promotionGate.readiness.reviewState,
              "no promotion gate",
            )}
          />
        </div>
      </div>

      <div className={styles.postureStrip}>
        <PostureItem
          label="Authority"
          value={boolText(data.authorityBoundary.ideaToSpecWorkspaceIsAuthority)}
        />
        <PostureItem
          label="Spec mutations"
          value={boolText(data.authorityBoundary.mayMutateCanonicalSpecs)}
        />
        <PostureItem
          label="Git writes"
          value={boolText(data.authorityBoundary.mayCreateBranchOrCommit)}
        />
        <PostureItem
          label="Git service"
          value={boolText(data.authorityBoundary.mayExecuteGitServiceOperation)}
        />
      </div>

      <div className={styles.entries}>
        <WorkflowSection workflow={data.workflow} />
        <IdeaIntakeDraftSection activeFrame={frame} />
        <WorkspaceSection workspace={data.workspace} />
        <FrameSection project={frame.project} domains={frame.domainRefs} contexts={frame.contextRefs} />
        <ArtifactSection artifacts={data.artifacts} />
        <IntakeSection state={state} />
        <OntologySeedSection seed={data.ontologySeed} />
        <CandidateGraphSection nodes={data.candidateGraph.nodes} />
        <PreSibSection state={state} />
        <RepairSection actions={data.repairLoop.actions} />
        <RepairSessionSection state={state} />
        <ProductRepairReviewSection
          state={state}
          repairDrafts={repairDrafts}
          workspaceId={data.selectedWorkspaceId ?? data.workspace.id}
        />
        <MaterializationSection state={state} />
        <PromotionGateSection state={state} />
        <ControlledPromotionSection state={state} />
      </div>
    </section>
  );
}

function IdeaIntakeDraftSection({
  activeFrame,
}: {
  activeFrame: IdeaToSpecActiveFrame;
}) {
  const [idea, setIdea] = useState("");
  const draft = useMemo(
    () => buildIdeaToSpecIntakeDraft({ idea, activeFrame }),
    [idea, activeFrame],
  );
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Idea intake draft" count={draft ? 1 : 0} />
      <div className={styles.row}>
        <textarea
          className={styles.ideaInput}
          value={idea}
          onChange={(event) => setIdea(event.currentTarget.value)}
          placeholder="Product idea, actors, events, constraints"
          rows={5}
          aria-label="Product idea intake"
        />
        <div className={styles.postureStrip}>
          <PostureItem label="Source" value={draft?.sourceMode ?? "local_browser_draft"} />
          <PostureItem
            label="Spec mutations"
            value={boolText(draft?.canonicalMutationsAllowed ?? false)}
          />
          <PostureItem
            label="Tracked writes"
            value={boolText(draft?.trackedArtifactsWritten ?? false)}
          />
        </div>
      </div>
      {draft ? (
        <div className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{draft.artifactKind}</span>
            <Pill value={draft.sourceMode} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Project" value={draft.project} />
            <Meta label="Actors" value={joined(draft.actors)} />
            <Meta label="Events" value={joined(draft.domainEvents)} />
            <Meta label="Commands" value={joined(draft.commands)} />
            <Meta label="Policies" value={joined(draft.policies)} />
            <Meta label="Constraints" value={joined(draft.constraints)} />
            <Meta
              label="Vocabulary"
              value={joined(draft.vocabularyQuestions)}
            />
            <Meta
              label="Context"
              value={joined(draft.contextCompletionQuestions)}
            />
          </div>
        </div>
      ) : (
        <Status
          label="No local idea draft"
          detail="Enter a product idea to preview event-storming intake candidates."
        />
      )}
    </section>
  );
}

function WorkflowSection({ workflow }: { workflow: IdeaToSpecWorkflow }) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Workflow lane" count={workflow.items.length} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>{workflow.stage.replace(/_/g, " ")}</span>
          <Pill value={workflow.status} />
        </div>
        <div className={styles.workflowGrid}>
          {workflow.items.map((item) => (
            <div key={item.id} className={styles.workflowItem}>
              <div className={styles.workflowItemHeader}>
                <span className={styles.metaLabel}>{item.label}</span>
                <Pill value={item.status} />
              </div>
              <span className={styles.metaValue}>
                {compact(item.detail ?? item.artifactPath, "no detail")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Next handoff</span>
          <Pill value={workflow.nextHandoff.status} />
        </div>
        <h3 className={styles.title}>{workflow.nextHandoff.label}</h3>
        <div className={styles.metaGrid}>
          <Meta label="Kind" value={workflow.nextHandoff.kind} />
          <Meta label="Authority" value={workflow.nextHandoff.authorityBoundary} />
          <Meta label="Artifact" value={workflow.nextHandoff.artifactPath} />
          <Meta label="Command" value={workflow.nextHandoff.commandTemplate} />
        </div>
      </div>
    </section>
  );
}

function WorkspaceSection({
  workspace,
}: {
  workspace: IdeaToSpecWorkspace["workspace"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Active workspace" count={workspace.available ? 1 : 0} />
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={workspace.displayName ?? workspace.id} />
          <Meta label="Route" value={workspace.publicRoute} />
          <Meta label="Lane" value={workspace.workflowLane} />
          <Meta label="Role" value={workspace.targetRepositoryRole} />
          <Meta label="Source" value={workspace.sourceMode} />
          <Meta label="Ready" value={boolText(workspace.ready)} />
        </div>
      </div>
    </section>
  );
}

function FrameSection({
  project,
  domains,
  contexts,
}: {
  project: string | null;
  domains: readonly string[];
  contexts: readonly string[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Active frame" count={domains.length + contexts.length} />
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          <Meta label="Project" value={project} />
          <Meta label="Domains" value={joined(domains)} />
          <Meta label="Contexts" value={joined(contexts)} />
        </div>
      </div>
    </section>
  );
}

function ArtifactSection({
  artifacts,
}: {
  artifacts: IdeaToSpecWorkspace["artifacts"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Source artifacts" count={Object.keys(artifacts).length} />
      {Object.entries(artifacts).map(([name, artifact]) => (
        <div key={name} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{name.replace(/_/g, " ")}</span>
            <Pill value={artifact.available ? "available" : compact(artifact.reason, "missing")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Path" value={artifact.path} />
            <Meta label="Status" value={artifact.status} />
            <Meta label="Proposal" value={artifact.proposalId} />
            <Meta label="Kind" value={artifact.artifactKind} />
          </div>
        </div>
      ))}
    </section>
  );
}

function IntakeSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const summary = state.data.intake.summary;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Event-storming intake" count={summary.domainEventCount} />
      <div className={styles.postureStrip}>
        <PostureItem label="Actors" value={String(summary.actorCount)} />
        <PostureItem label="Events" value={String(summary.domainEventCount)} />
        <PostureItem label="Commands" value={String(summary.commandCount)} />
        <PostureItem label="Policies" value={String(summary.policyCount)} />
        <PostureItem label="Constraints" value={String(summary.constraintCount)} />
        <PostureItem
          label="Vocabulary"
          value={String(summary.vocabularyQuestionCount)}
        />
      </div>
    </section>
  );
}

function OntologySeedSection({
  seed,
}: {
  seed: IdeaToSpecWorkspace["ontologySeed"];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Ontology-bound seed"
        count={seed.summary.ontologyGapCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(seed.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(seed.readiness.reviewState)}
        />
        <PostureItem
          label="Bindings"
          value={String(seed.summary.ontologyBindingCount)}
        />
        <PostureItem label="Gaps" value={String(seed.summary.ontologyGapCount)} />
        <PostureItem
          label="Findings"
          value={String(seed.summary.findingCount)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {compact(seed.ontology.id, "ontology package")}
          </span>
          <Pill value={seed.available ? "available" : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Version" value={seed.ontology.version} />
          <Meta label="Source" value={seed.ontology.sourceRef ?? seed.sourceRef} />
          <Meta label="Classes" value={String(seed.ontology.classCount)} />
          <Meta label="Relations" value={String(seed.ontology.relationCount)} />
          <Meta label="Contract" value={seed.generationContractRef ?? seed.contractRef} />
          <Meta label="Blocked by" value={joined(seed.readiness.blockedBy)} />
        </div>
      </div>
      {seed.bindings.length === 0 ? (
        <Status
          label="No ontology bindings"
          detail="Candidate seed has no visible ontology bindings."
        />
      ) : null}
      {seed.bindings.map((binding, index) => (
        <div key={`${index}:${binding.term}:${binding.ontologyRef ?? ""}`} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{binding.term}</span>
            <Pill value={compact(binding.bindingKind, "binding")} />
          </div>
          <div className={styles.metaGrid}>
            <Meta label="Ontology ref" value={binding.ontologyRef} />
            <Meta label="Authority" value={binding.authority} />
            <Meta label="Reason" value={binding.reason} />
          </div>
        </div>
      ))}
      {seed.gaps.length === 0 ? (
        <Status
          label="No ontology gaps"
          detail="Candidate seed did not surface project-local ontology gaps."
        />
      ) : null}
      {seed.gaps.map((gap) => (
        <div key={gap.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{gap.id}</span>
            <Pill value={gap.blocksCandidateGraph ? "blocks" : "review"} />
          </div>
          <h3 className={styles.title}>{compact(gap.term, gap.kind)}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={gap.sourceRef} />
            <Meta label="Kind" value={gap.sourceKind ?? gap.kind} />
            <Meta label="Suggested" value={gap.suggestedAction} />
            <Meta label="Statement" value={gap.statement} />
          </div>
        </div>
      ))}
      {seed.findings.map((finding) => (
        <div key={finding.findingId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function CandidateGraphSection({
  nodes,
}: {
  nodes: readonly IdeaToSpecCandidateNode[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Candidate graph" count={nodes.length} />
      {nodes.length === 0 ? (
        <Status label="No candidate nodes" detail="Candidate graph artifact is empty." />
      ) : null}
      {nodes.map((node) => (
        <div key={node.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{node.id}</span>
            <Pill value={compact(node.kind, "node")} />
          </div>
          <h3 className={styles.title}>{compact(node.title, "Candidate node")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Requirements" value={String(node.requirementCount)} />
            <Meta label="Acceptance" value={String(node.acceptanceCriteriaCount)} />
            <Meta label="Claims" value={String(node.claimCount)} />
            <Meta label="Gaps" value={String(node.gapCount)} />
            <Meta label="Ontology refs" value={joined(node.ontologyRefs)} />
          </div>
        </div>
      ))}
    </section>
  );
}

function PreSibSection({ state }: { state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }> }) {
  const data = state.data;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Pre-SIB coherence" count={data.preSib.findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(data.preSib.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(data.preSib.readiness.reviewState)}
        />
        <PostureItem
          label="Blocked by"
          value={joined(data.preSib.readiness.blockedBy)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.metaGrid}>
          {Object.entries(data.preSib.metrics).map(([key, value]) => (
            <Meta key={key} label={key.replace(/_/g, " ")} value={metricValue(value)} />
          ))}
        </div>
      </div>
      {data.preSib.findings.map((finding) => (
        <div key={finding.findingId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
    </section>
  );
}

function RepairSection({
  actions,
}: {
  actions: readonly IdeaToSpecRepairAction[];
}) {
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Repair loop" count={actions.length} />
      {actions.length === 0 ? (
        <Status label="No repair actions" detail="Repair loop artifact is empty." />
      ) : null}
      {actions.map((action) => (
        <div key={action.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{action.id}</span>
            <Pill value={action.status} />
          </div>
          <h3 className={styles.title}>{action.kind.replace(/_/g, " ")}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Target" value={action.targetRef} />
            <Meta label="Findings" value={joined(action.sourceFindings)} />
            <Meta label="Rationale" value={action.rationale} />
          </div>
        </div>
      ))}
    </section>
  );
}

function RepairSessionSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const session = state.data.repairSession;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Repair session"
        count={
          session.stages.length +
          session.openBlockers.length +
          session.acceptedAnswers.length
        }
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Source" value={session.sourceMode} />
        <PostureItem
          label="Ready"
          value={boolText(session.readiness.ready)}
        />
        <PostureItem
          label="Candidate approval"
          value={boolText(session.readinessImpact.readyForCandidateApproval)}
        />
        <PostureItem
          label="Platform promotion"
          value={boolText(session.readinessImpact.readyForPlatformPromotion)}
        />
        <PostureItem
          label="Unresolved gaps"
          value={String(session.readinessImpact.unresolvedOntologyGapCount)}
        />
        <PostureItem
          label="Promotion paths"
          value={String(session.readinessImpact.promotionPathCount)}
        />
      </div>
      {!session.available ? (
        <Status
          label="No repair session journal"
          detail="Using legacy repair artifacts until runs/idea_to_spec_repair_session.json is published."
        />
      ) : null}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>
            {compact(session.session.sessionId, "repair-session")}
          </span>
          <Pill value={compact(session.readiness.reviewState, "unknown")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={session.session.candidateId} />
          <Meta label="Lane" value={session.session.workflowLane} />
          <Meta label="Route" value={session.session.workspaceRoute} />
          <Meta label="Operator" value={session.session.operatorRef} />
          <Meta
            label="Quality"
            value={session.readinessImpact.candidateQualityReviewState}
          />
          <Meta
            label="Promotion gate"
            value={session.readinessImpact.promotionGateReviewState}
          />
          <Meta
            label="Active candidate"
            value={session.readinessImpact.activeCandidateReviewState}
          />
          <Meta
            label="Blocked by"
            value={joined(session.readinessImpact.blockedBy)}
          />
          <Meta
            label="Platform blocked"
            value={joined(session.readinessImpact.platformPromotionBlockedBy)}
          />
          <Meta label="Rerun overlay" value={session.rerunOverlay.sourceRef} />
        </div>
      </div>
      {session.openBlockers.map((blocker) => (
        <RepairSessionBlockerRow
          key={`${blocker.kind}:${blocker.id}`}
          blocker={blocker}
        />
      ))}
      {session.stages.map((stage) => (
        <RepairSessionStageRow
          key={`${stage.index ?? "stage"}:${stage.stage}:${stage.sourceRef ?? ""}`}
          stage={stage}
        />
      ))}
      {session.acceptedAnswers.map((answer) => (
        <AcceptedAnswerRow
          key={`${answer.requestId}:${answer.answerKind}`}
          answer={answer}
        />
      ))}
    </section>
  );
}

function RepairSessionBlockerRow({
  blocker,
}: {
  blocker: IdeaToSpecRepairSessionBlocker;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{blocker.id}</span>
        <Pill value={blocker.kind} />
      </div>
    </div>
  );
}

function RepairSessionStageRow({
  stage,
}: {
  stage: IdeaToSpecRepairSessionStage;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{stage.stage}</span>
        <Pill value={stage.ready ? "ready" : "blocked"} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Artifact kind" value={stage.artifactKind} />
        <Meta label="Source" value={stage.sourceRef} />
        <Meta label="Review state" value={stage.reviewState} />
        <Meta label="Status" value={stage.status} />
        <Meta label="Blocked by" value={joined(stage.blockedBy)} />
        <Meta label="Next" value={stage.nextArtifact} />
      </div>
    </div>
  );
}

function AcceptedAnswerRow({
  answer,
}: {
  answer: IdeaToSpecAcceptedAnswer;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{answer.requestId}</span>
        <Pill value={answer.answerKind} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Status" value={answer.status} />
        <Meta label="Request kind" value={answer.requestKind} />
        <Meta label="Target artifact" value={answer.targetArtifact} />
        <Meta label="Target" value={answer.targetRef} />
        <Meta label="Terms" value={joined(answer.terms)} />
        <Meta label="Scope" value={answer.termScope} />
      </div>
    </div>
  );
}

function ProductRepairReviewSection({
  state,
  repairDrafts,
  workspaceId,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
  repairDrafts: ReturnType<typeof useIdeaToSpecRepairDrafts>;
  workspaceId: string | null;
}) {
  const lane = state.data.repairReview;
  const quality = lane.rerunPreview.candidateQualityPreview;
  const delta = lane.rerunMaterialization.delta;
  const draftCount =
    repairDrafts.state.kind === "ok"
      ? repairDrafts.state.data.summary.draftCount
      : 0;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Product repair review"
        count={
          lane.clarificationRequests.requestCount +
          lane.ontologyDecisions.decisionCount +
          draftCount
        }
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Requests"
          value={String(lane.clarificationRequests.requestCount)}
        />
        <PostureItem
          label="Answers"
          value={String(lane.clarificationAnswers.answerCount)}
        />
        <PostureItem
          label="Decisions"
          value={String(lane.ontologyDecisions.decisionCount)}
        />
        <PostureItem label="Drafts" value={String(draftCount)} />
        <PostureItem
          label="Quality"
          value={compact(quality.reviewState, "not previewed")}
        />
        <PostureItem
          label="Removed"
          value={String(delta.removedGapIds.length)}
        />
      </div>
      {!lane.available ? (
        <Status
          label="No repair review lane"
          detail="Clarification and rerun preview artifacts are not published for this workspace."
        />
      ) : null}
      <RepairDraftStatus state={repairDrafts.state} />
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Ontology gap quality</span>
          <Pill value={compact(quality.ontologyGapState, "unknown")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta
            label="Resolved"
            value={String(quality.resolvedOntologyGapCount)}
          />
          <Meta
            label="Unresolved"
            value={String(quality.unresolvedOntologyGapCount)}
          />
          <Meta label="Removed gaps" value={joined(delta.removedGapIds)} />
          <Meta
            label="Still open"
            value={joined(delta.unresolvedOntologyGapIds)}
          />
        </div>
      </div>
      {lane.clarificationRequests.requests.map((request) => (
        <ClarificationRequestRow
          key={request.id}
          request={request}
          draft={repairDrafts.draftsByRequestId.get(request.id)}
          pending={repairDrafts.pendingRequestId === request.id}
          onSave={(input) =>
            repairDrafts.saveDraft({
              ...input,
              workspaceId,
              operatorRef: "operator://specspace-local",
            })
          }
        />
      ))}
      {lane.ontologyDecisions.decisions.map((decision) => (
        <OntologyDecisionRow key={decision.id} decision={decision} />
      ))}
      {lane.rerunPreview.resolvedGaps.map((gap) => (
        <ResolvedGapRow key={gap.gapId} gap={gap} />
      ))}
    </section>
  );
}

function RepairDraftStatus({
  state,
}: {
  state: UseIdeaToSpecRepairDraftsState;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <Status
        label="Repair drafts loading"
        detail="Reading SpecSpace-owned repair draft state."
      />
    );
  }
  if (state.kind === "ok") {
    return (
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>SpecSpace repair drafts</span>
          <Pill value={state.data.summary.status} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Drafts" value={String(state.data.summary.draftCount)} />
          <Meta label="State owner" value={state.data.stateOwner} />
          <Meta
            label="SpecGraph authority"
            value={boolText(state.data.authorityBoundary.specgraphArtifactAuthority)}
          />
          <Meta
            label="Ontology writes"
            value={boolText(state.data.consumerBoundary.mayWriteOntologyPackage)}
          />
        </div>
      </div>
    );
  }
  return (
    <Status
      label="Repair drafts unavailable"
      detail={repairDraftStateDetail(state)}
    />
  );
}

function ClarificationRequestRow({
  request,
  draft,
  pending,
  onSave,
}: {
  request: IdeaToSpecClarificationRequest;
  draft: IdeaToSpecRepairDraft | undefined;
  pending: boolean;
  onSave: (input: IdeaToSpecRepairDraftInput) => void;
}) {
  const [selectedAction, setSelectedAction] = useState(
    () => draft?.allowedAction ?? request.suggestedActions[0] ?? "",
  );
  const [draftText, setDraftText] = useState(() => repairDraftText(draft) ?? "");

  useEffect(() => {
    if (!draft) return;
    setSelectedAction(draft.allowedAction);
    setDraftText(repairDraftText(draft) ?? "");
  }, [draft]);

  const answerValue = answerValueForDraftAction(selectedAction, draftText);
  const canSave = !!selectedAction && draftText.trim().length > 0 && !pending;
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{request.id}</span>
        <Pill value={request.status} />
      </div>
      <h3 className={styles.title}>{compact(request.question, request.kind)}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Severity" value={request.severity} />
        <Meta label="Target" value={request.targetRef} />
        <Meta label="Actions" value={joined(request.suggestedActions)} />
      </div>
      <form
        className={styles.draftForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave({
            requestId: request.id,
            action: selectedAction,
            answerValue,
            targetRef: request.targetRef,
          });
        }}
      >
        <div className={styles.draftControls}>
          <select
            className={styles.draftSelect}
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.currentTarget.value)}
            aria-label="Repair draft action"
          >
            {request.suggestedActions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button className={styles.ackButton} type="submit" disabled={!canSave}>
            {pending ? "Saving" : draft ? "Update draft" : "Save draft"}
          </button>
        </div>
        <textarea
          className={styles.draftTextarea}
          value={draftText}
          onChange={(event) => setDraftText(event.currentTarget.value)}
          placeholder={draftPlaceholder(selectedAction)}
          rows={3}
          aria-label="Repair draft value"
        />
        {draft ? (
          <span className={styles.statusDetail}>
            Draft saved · {draft.allowedAction.replace(/_/g, " ")} · {draft.updatedAt}
          </span>
        ) : null}
      </form>
    </div>
  );
}

function repairDraftStateDetail(
  state: Exclude<UseIdeaToSpecRepairDraftsState, { kind: "ok" | "idle" | "loading" }>,
): string {
  if (state.kind === "http-error") {
    return `HTTP ${state.status}: ${state.statusText}`;
  }
  if (state.kind === "network-error") {
    return "SpecSpace repair draft endpoint is unreachable from the browser.";
  }
  return state.message;
}

function answerValueForDraftAction(
  action: string,
  text: string,
): Record<string, unknown> {
  const value = text.trim();
  if (action === "bind_existing_term") return { ontology_ref: value };
  if (action === "alias") return { alias_of: value };
  if (action === "propose_project_local_term") {
    return {
      terms: value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
      term_scope: "project_local",
    };
  }
  if (action === "reject" || action === "defer") return { reason: value };
  return { text: value };
}

function repairDraftText(draft: IdeaToSpecRepairDraft | undefined): string | null {
  if (!draft) return null;
  const value = draft.answerValue;
  if (typeof value.ontology_ref === "string") return value.ontology_ref;
  if (typeof value.alias_of === "string") return value.alias_of;
  if (typeof value.reason === "string") return value.reason;
  if (Array.isArray(value.terms)) {
    return value.terms.filter((item): item is string => typeof item === "string").join(", ");
  }
  if (typeof value.text === "string") return value.text;
  return null;
}

function draftPlaceholder(action: string): string {
  if (action === "bind_existing_term") return "ontology://...";
  if (action === "alias") return "accepted term";
  if (action === "propose_project_local_term") return "Project-local term";
  if (action === "reject" || action === "defer") return "Reason";
  return "Draft answer";
}

function OntologyDecisionRow({
  decision,
}: {
  decision: IdeaToSpecOntologyDecision;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{decision.id}</span>
        <Pill value={decision.decisionType} />
      </div>
      <h3 className={styles.title}>{compact(decision.term, "ontology decision")}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Status" value={decision.status} />
        <Meta label="Ontology ref" value={decision.ontologyRef} />
        <Meta label="Alias of" value={decision.aliasOf} />
        <Meta label="Target" value={decision.targetRef} />
        <Meta label="Intent" value={decision.materializationIntent} />
      </div>
    </div>
  );
}

function ResolvedGapRow({ gap }: { gap: IdeaToSpecResolvedOntologyGap }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{gap.gapId}</span>
        <Pill value={compact(gap.decision, "resolved")} />
      </div>
      <h3 className={styles.title}>{compact(gap.term, "Resolved ontology gap")}</h3>
      <div className={styles.metaGrid}>
        <Meta label="Node" value={gap.nodeId} />
        <Meta label="Source" value={gap.sourceRef} />
        <Meta label="Target" value={gap.targetRef} />
      </div>
    </div>
  );
}

function MaterializationSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const materialization = state.data.materialization;
  const request = materialization.promotionRequest;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Promotion preview"
        count={materialization.files.length}
      />
      <div className={styles.postureStrip}>
        <PostureItem
          label="Ready"
          value={boolText(materialization.readiness.ready)}
        />
        <PostureItem
          label="Review state"
          value={compact(materialization.readiness.reviewState)}
        />
        <PostureItem
          label="Source"
          value={compact(materialization.materializationSource)}
        />
        <PostureItem
          label="Platform request"
          value={compact(request.platformArtifactKind)}
        />
      </div>
      {materialization.files.length === 0 ? (
        <Status
          label="No materialized candidate specs"
          detail="Candidate materialization report is missing or empty."
        />
      ) : null}
      {materialization.files.map((file) => (
        <MaterializedFileRow key={file.path} file={file} />
      ))}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Platform handoff</span>
          <Pill value={compact(request.pathArgument, "--path")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Promotion paths" value={joined(request.paths)} />
          <Meta label="Next" value={materialization.readiness.nextArtifact} />
        </div>
      </div>
    </section>
  );
}

function MaterializedFileRow({ file }: { file: IdeaToSpecMaterializedFile }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{file.materializedId}</span>
        <Pill value="review-only" />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Candidate node" value={file.candidateNodeId} />
        <Meta label="Preview path" value={file.path} />
        <Meta label="Promotion path" value={file.promotionPath} />
      </div>
    </div>
  );
}

function PromotionGateSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const gate = state.data.promotionGate;
  const request = gate.promotionRequest;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader title="Promotion gate" count={gate.findings.length} />
      <div className={styles.postureStrip}>
        <PostureItem label="Ready" value={boolText(gate.readiness.ready)} />
        <PostureItem
          label="Review state"
          value={compact(gate.readiness.reviewState)}
        />
        <PostureItem
          label="Blocked by"
          value={joined(gate.readiness.blockedBy)}
        />
        <PostureItem
          label="Promotion paths"
          value={String(request.paths.length)}
        />
      </div>
      {gate.findings.length === 0 ? (
        <Status
          label="Promotion gate clear"
          detail={compact(gate.readiness.nextArtifact, "Platform handoff ready.")}
        />
      ) : null}
      {gate.findings.map((finding) => (
        <div key={finding.findingId} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.rowId}>{finding.findingId}</span>
            <Pill value={finding.severity} />
          </div>
          <h3 className={styles.title}>{finding.message}</h3>
          <div className={styles.metaGrid}>
            <Meta label="Source" value={finding.sourceRef} />
          </div>
        </div>
      ))}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Gate handoff</span>
          <Pill value={compact(request.pathArgument, "--path")} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Platform request" value={request.platformArtifactKind} />
          <Meta label="Promotion paths" value={joined(request.paths)} />
          <Meta label="Next" value={gate.readiness.nextArtifact} />
        </div>
      </div>
    </section>
  );
}

function ControlledPromotionSection({
  state,
}: {
  state: Extract<UseIdeaToSpecWorkspaceState, { kind: "ok" }>;
}) {
  const promotion = state.data.controlledPromotion;
  const approval = promotion.candidateApproval;
  const request = promotion.platformRequest;
  const execution = promotion.gitServiceExecution;
  const reviewStatus = promotion.reviewStatus;
  const readModel = promotion.readModelPublication;
  const finalization = promotion.promotionFinalization;
  const operationCount = execution.operations.length + finalization.operations.length;
  return (
    <section className={styles.reviewSection}>
      <SectionHeader
        title="Controlled promotion"
        count={operationCount}
      />
      <div className={styles.postureStrip}>
        <PostureItem label="Inspect only" value={boolText(promotion.actionBoundary.inspectOnly)} />
        <PostureItem label="Execute" value={boolText(promotion.actionBoundary.mayExecuteGitService)} />
        <PostureItem label="Commit" value={boolText(promotion.actionBoundary.mayCreateBranchOrCommit)} />
        <PostureItem label="Merge" value={boolText(promotion.actionBoundary.mayMergeReview)} />
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Candidate approval</span>
          <Pill value={approval.available ? (approval.ready ? "approved" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={approval.candidateId} />
          <Meta label="Decision" value={approval.decisionState} />
          <Meta label="Review state" value={approval.reviewState} />
          <Meta label="Operator" value={approval.operatorRef} />
          <Meta label="Reason" value={approval.reason} />
          <Meta label="Promotion paths" value={joined(approval.promotionPaths)} />
          <Meta label="Blocked by" value={joined(approval.blockedBy)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Platform promotion request</span>
          <Pill value={request.available ? (request.ok ? "ready" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={request.candidateId} />
          <Meta label="Branch" value={request.candidateBranch} />
          <Meta label="Base" value={request.review.baseBranch} />
          <Meta label="Title" value={request.review.title} />
          <Meta label="Commit paths" value={joined(request.commitPaths)} />
          <Meta label="Operations" value={joined(request.requestedOperations)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Git Service execution</span>
          <Pill value={execution.available ? (execution.ok ? "ok" : "blocked") : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Candidate" value={execution.candidateId} />
          <Meta label="Ref" value={execution.candidateRef} />
          <Meta label="Workspace" value={execution.workspaceDir} />
          <Meta label="Dry run" value={boolText(execution.dryRun)} />
          <Meta label="Open review dry run" value={boolText(execution.openReviewDryRun)} />
          <Meta label="Copied files" value={String(execution.copiedFileCount)} />
          <Meta label="Completed ops" value={String(execution.completedOperationCount)} />
          <Meta label="Errors" value={String(execution.errorCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Review status</span>
          <Pill value={reviewStatus.available ? (reviewStatus.reviewMerged ? "merged" : compact(reviewStatus.reviewState, "open")) : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="State" value={reviewStatus.reviewState} />
          <Meta label="Decision" value={reviewStatus.reviewDecision} />
          <Meta label="URL" value={reviewStatus.reviewUrl} />
          <Meta label="Merged" value={boolText(reviewStatus.reviewMerged)} />
          <Meta label="Errors" value={String(reviewStatus.errorCount)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowId}>Read-model publication</span>
          <Pill value={readModel.available ? (readModel.published ? "published" : "blocked") : finalization.readModelPublished ? "published" : "missing"} />
        </div>
        <div className={styles.metaGrid}>
          <Meta label="Review" value={readModel.reviewState ?? finalization.reviewState} />
          <Meta label="Published" value={boolText(readModel.published || finalization.readModelPublished)} />
          <Meta label="Dry run" value={boolText(readModel.dryRun || finalization.dryRun)} />
          <Meta label="Manifest" value={readModel.manifest} />
          <Meta label="Files" value={String(readModel.fileCount)} />
          <Meta label="Finalization ops" value={String(finalization.operationCount)} />
          <Meta label="Errors" value={String(readModel.errorCount + finalization.errorCount)} />
        </div>
      </div>
      {operationCount === 0 ? (
        <Status
          label="No Git Service execution"
          detail="Promotion can be inspected here after Platform publishes the execution report."
        />
      ) : null}
      {execution.operations.map((operation) => (
        <GitServiceOperationRow key={operation.name} operation={operation} />
      ))}
      {finalization.operations.map((operation) => (
        <GitServiceOperationRow key={`finalization.${operation.name}`} operation={operation} />
      ))}
    </section>
  );
}

function GitServiceOperationRow({
  operation,
}: {
  operation: IdeaToSpecGitServiceOperation;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowId}>{operation.name.replace(/_/g, " ")}</span>
        <Pill value={operation.status} />
      </div>
      <div className={styles.metaGrid}>
        <Meta label="Request" value={operation.requestArtifactKind} />
        <Meta label="Response" value={operation.responseArtifactKind} />
        <Meta label="Report" value={operation.reportRef} />
        <Meta label="Diagnostics" value={String(operation.diagnosticCount)} />
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.kicker}>{title}</span>
      <span className={styles.sectionCount}>{count}</span>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function Pill({ value }: { value: string }) {
  return <span className={styles.pill}>{value}</span>;
}

function PostureItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.postureItem}>
      <span className={styles.postureLabel}>{label}</span>
      <span className={styles.postureValue}>{value}</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{compact(value, "none")}</span>
    </div>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.status}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
