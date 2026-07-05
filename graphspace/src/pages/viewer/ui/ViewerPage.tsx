import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  addAgentContextItem,
  clearAgentContextItems,
  createAgentContextDraft,
  createMetricContextItem,
  createSpecMarkdownContextItem,
  createMetricConversationPromptSeed,
  createSpecMarkdownConversationPromptSeed,
  createSpecEdgeContextItem,
  createSpecGapContextItem,
  createProposalContextItem,
  createProposalConversationPromptSeed,
  removeAgentContextItem,
  type AgentConversationPromptSeed,
  type AgentContextSpecGapKind,
  type SpecMarkdownContextSource,
} from "@/entities/agent-workbench";
import type { SpecEdge } from "@/entities/spec-edge";
import { createSpecNodeRefResolver } from "@/entities/spec-node";
import type { SpecPMLifecycleBadge } from "@/entities/specpm-lifecycle";
import { addSpecNodeToAgentContext } from "@/features/add-spec-to-agent-context";
import { createMockAgentConversationRuntime } from "@/features/start-agent-conversation";
import { useToneFilter, filterByTone } from "@/features/filter-by-tone";
import {
  useSpecSearch,
  filterBySpecQuery,
} from "@/features/search-by-spec";
import { useRunsWatchVersion } from "@/shared/api";
import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { AgentConversationPanel } from "@/widgets/agent-conversation-panel";
import { AgentContextPanel } from "@/widgets/agent-context-panel";
import { useRecentChanges } from "@/widgets/recent-changes-panel";
import {
  ImplementationWorkPanel,
  useImplementationWorkIndex,
} from "@/widgets/implementation-work-panel";
import {
  ProposalTracePanel,
  useProposalSpecTraceIndex,
} from "@/widgets/proposal-trace";
import {
  SpecGraphCanvas,
  buildSpecGraphCanvasOverlays,
  useSpecGraph,
  useSpecPMLifecycleBadges,
  type SpecGraphCanvasOverlayKind,
} from "@/widgets/spec-graph-canvas";
import { SpecEdgeInspector } from "@/widgets/spec-edge-inspector";
import { SpecInspector, type SpecInspectorSelection } from "@/widgets/spec-inspector";
import { SpecNodeNavigator } from "@/widgets/spec-node-navigator";
import { describeCapabilityDiagnostics } from "../model/capability-diagnostics";
import { describeArtifact, describeSourceDeltaSnapshot } from "../model/live-artifacts";
import { describeLive } from "../model/live-status";
import {
  createSpecSelectionHistory,
  goBackSpecSelectionHistory,
  goForwardSpecSelectionHistory,
  pruneSpecSelectionHistory,
  pushSpecSelectionHistory,
} from "../model/spec-selection-history";
import {
  describeDeploymentStatus,
  shouldUseLocalSpecPMLifecycle,
  shouldUseRunsWatch,
  uiDeploymentInfo,
  useApiDeploymentStatus,
} from "../model/deployment-status";
import {
  DEFAULT_RECENT_TIMELINE_FILTER,
  filterRecentChangesByTimeline,
  hasRecentTimelineFilter,
  withRecentTimelineField,
  withRecentTimelineRange,
  type RecentTimelineField,
  type RecentTimelineRange,
} from "../model/recent-timeline-filter";
import {
  SAMPLE_ENTRIES,
  SAMPLE_NOW,
  SAMPLE_PROPOSAL_TRACES,
  SAMPLE_WORK_ITEMS,
} from "../model/sample-data";
import { LiveArtifactStatusPanel } from "./LiveArtifactStatusPanel";
import { AgentSurfacesPanel } from "./AgentSurfacesPanel";
import { IdeaToSpecWorkspacePanel } from "./IdeaToSpecWorkspacePanel";
import { MetricsViewerPanel } from "./MetricsViewerPanel";
import { OntologyComplianceReviewPanel } from "./OntologyComplianceReviewPanel";
import { OntologyOwnerDecisionReviewPanel } from "./OntologyOwnerDecisionReviewPanel";
import { OntologyReviewDashboardPanel } from "./OntologyReviewDashboardPanel";
import { OntologyWorkbenchPanel } from "./OntologyWorkbenchPanel";
import { PracticalOntologyPanel } from "./PracticalOntologyPanel";
import { ProposalViewerPanel } from "./ProposalViewerPanel";
import { RecentActivitySurface } from "./RecentActivitySurface";
import { SpecPMRegistryPanel } from "./SpecPMRegistryPanel";
import { UtilityPanelHeader } from "./UtilityPanelHeader";
import {
  SelectionHistoryButtons,
  ViewerChrome,
  type ViewerUtilityPanelId,
} from "./ViewerChrome";
import { useMetricsIndex } from "../model/use-metrics-index";
import { useAgentSurfaces } from "../model/use-agent-surfaces";
import { useArtifactCatalog } from "../model/use-artifact-catalog";
import { useIdeaToSpecWorkspace } from "../model/use-idea-to-spec-workspace";
import { useOntologyComplianceReview } from "../model/use-ontology-compliance-review";
import { useOntologyOwnerDecisionReview } from "../model/use-ontology-owner-decision-review";
import { useOntologyReviewDashboard } from "../model/use-ontology-review-dashboard";
import { useOntologyWorkbench } from "../model/use-ontology-workbench";
import { usePracticalOntology } from "../model/use-practical-ontology";
import {
  useProductWorkspaceCreationRequests,
  type ProductWorkspaceCreationRequestError,
} from "../model/use-product-workspace-creation-requests";
import { useProposalIndex } from "../model/use-proposal-index";
import { useSpecSpaceCapabilities } from "../model/use-specspace-capabilities";
import { useSpecPMRegistrySummary } from "../model/use-specpm-registry-summary";
import { proposalTraceEntriesForPanel } from "../model/proposal-trace-entries";
import {
  SPECGRAPH_BOOTSTRAP_WORKSPACE,
  SPECSPACE_WORKSPACES,
  workspaceApiUrl,
  type SpecSpaceWorkspace,
} from "../model/workspace-route";
import type { MetricsViewerContextFilter } from "../model/metrics-filters";
import type { ProposalViewerContextFilter } from "../model/proposal-filters";
import styles from "./ViewerPage.module.css";

/**
 * Viewer page shell: live data via graph contract hooks with sample fallback
 * when the backend is offline, not configured, or emits invalid artifacts.
 */
type ViewerPageProps = {
  workspace?: SpecSpaceWorkspace;
};

const WORKSPACE_LANE_LABELS: Record<SpecSpaceWorkspace["workflowLane"], string> = {
  specgraph_bootstrap_showcase: "SpecGraph bootstrap showcase",
  product_idea_to_spec: "Product idea-to-spec",
};

const WORKSPACE_ROLE_LABELS: Record<
  SpecSpaceWorkspace["targetRepositoryRole"],
  string
> = {
  specgraph_bootstrap: "SpecGraph bootstrap",
  product_spec_workspace: "Product spec workspace",
};

const RESERVED_WORKSPACE_SLUGS = new Set([
  "bootstrap",
  "specgraph",
  "specgraph-bootstrap",
]);

function productWorkspaceSlugFromInput(value: string): string | null {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return null;
  if (RESERVED_WORKSPACE_SLUGS.has(slug)) return null;
  return slug;
}

function workspaceCreationSaveErrorMessage(
  error: ProductWorkspaceCreationRequestError,
): string {
  if (error.kind !== "http-error") return "Workspace request failed.";
  const body = error.body;
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim()
  ) {
    return body.error;
  }
  return "Workspace request failed.";
}

export function ViewerPage({
  workspace = SPECGRAPH_BOOTSTRAP_WORKSPACE,
}: ViewerPageProps) {
  const productWorkspace = workspace.surfaceMode === "product_idea_to_spec";
  const workspaceSwitcherItems = useMemo(() => {
    if (SPECSPACE_WORKSPACES.some((item) => item.id === workspace.id)) {
      return SPECSPACE_WORKSPACES;
    }
    return [...SPECSPACE_WORKSPACES, workspace];
  }, [workspace]);
  const [sidebarOpen, setSidebarOpen] = useState(productWorkspace);
  const [activeUtilityPanel, setActiveUtilityPanel] =
    useState<ViewerUtilityPanelId | null>(
      productWorkspace ? "idea-to-spec" : null,
    );
  const [utilityPanelExpanded, setUtilityPanelExpanded] = useState(false);
  const [proposalContextFilter, setProposalContextFilter] =
    useState<ProposalViewerContextFilter | null>(null);
  const [metricsContextFilter, setMetricsContextFilter] =
    useState<MetricsViewerContextFilter | null>(null);
  const [selectedSpecNodeId, setSelectedSpecNodeId] = useState<string | null>(null);
  const [selectedSpecEdgeId, setSelectedSpecEdgeId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<SpecInspectorSelection | null>(null);
  const [specSelectionHistory, setSpecSelectionHistory] = useState(
    createSpecSelectionHistory,
  );
  const specSelectionHistoryRef = useRef(specSelectionHistory);
  const [canvasVisibleSpecNodeIds, setCanvasVisibleSpecNodeIds] =
    useState<ReadonlySet<string> | null>(null);
  const [recentTimelineFilter, setRecentTimelineFilter] = useState(
    DEFAULT_RECENT_TIMELINE_FILTER,
  );
  const [agentContextDraft, setAgentContextDraft] = useState(() =>
    createAgentContextDraft(new Date().toISOString()),
  );
  const [agentConversationPromptSeed, setAgentConversationPromptSeed] =
    useState<AgentConversationPromptSeed | null>(null);
  const [ideaToSpecWorkspaceRefreshKey, setIdeaToSpecWorkspaceRefreshKey] =
    useState(0);
  const [newIdeaWorkspaceInput, setNewIdeaWorkspaceInput] = useState("");
  const [newIdeaWorkspaceRootIntent, setNewIdeaWorkspaceRootIntent] = useState("");
  const [newIdeaWorkspaceWizardOpen, setNewIdeaWorkspaceWizardOpen] =
    useState(false);
  const newIdeaWorkspaceLauncherButtonRef = useRef<HTMLButtonElement | null>(null);
  const newIdeaWorkspaceWizardRef = useRef<HTMLFormElement | null>(null);
  const newIdeaWorkspaceFirstFieldRef = useRef<HTMLInputElement | null>(null);
  const wasNewIdeaWorkspaceWizardOpenRef = useRef(false);
  const newIdeaWorkspaceSlug = useMemo(
    () => productWorkspaceSlugFromInput(newIdeaWorkspaceInput),
    [newIdeaWorkspaceInput],
  );
  const newIdeaWorkspaceRoute =
    newIdeaWorkspaceSlug !== null ? `/${newIdeaWorkspaceSlug}` : null;
  const agentConversationRuntime = useMemo(
    () => createMockAgentConversationRuntime({ id_prefix: "specspace-local" }),
    [],
  );
  const apiDeploymentState = useApiDeploymentStatus();
  const runsWatchVersion = useRunsWatchVersion({
    enabled: shouldUseRunsWatch(apiDeploymentState),
  });
  const workspaceApiUrls = useMemo(
    () => ({
      specGraph: workspaceApiUrl("/api/v1/spec-graph", workspace),
      specNodes: workspaceApiUrl("/api/v1/spec-nodes", workspace),
      specMarkdown: workspaceApiUrl("/api/v1/spec-markdown", workspace),
      specMarkdownCompile: workspaceApiUrl("/api/v1/spec-markdown/compile", workspace),
      specActivity: workspaceApiUrl("/api/v1/spec-activity", workspace),
      implementationWork: workspaceApiUrl(
        "/api/v1/implementation-work-index",
        workspace,
      ),
      proposalTrace: workspaceApiUrl("/api/v1/proposal-spec-trace-index", workspace),
      proposals: workspaceApiUrl("/api/v1/proposals", workspace),
      metrics: workspaceApiUrl("/api/v1/metrics", workspace),
      agentSurfaces: workspaceApiUrl("/api/v1/agent-surfaces", workspace),
      ideaToSpecWorkspace: workspaceApiUrl(
        "/api/v1/idea-to-spec-workspace",
        workspace,
      ),
      ideaToSpecRepairDrafts: workspaceApiUrl(
        "/api/v1/idea-to-spec-repair-drafts",
        workspace,
      ),
      ideaToSpecIntakeClarificationAnswers: workspaceApiUrl(
        "/api/v1/idea-to-spec-intake-clarification-answers",
        workspace,
      ),
      realIdeaEntryRequests: workspaceApiUrl(
        "/api/v1/real-idea-entry-requests",
        workspace,
      ),
      realIdeaIntakeExecutionRequests: workspaceApiUrl(
        "/api/v1/real-idea-intake-execution-requests",
        workspace,
      ),
      realIdeaAnswerContinuationExecutionRequests: workspaceApiUrl(
        "/api/v1/real-idea-answer-continuation-execution-requests",
        workspace,
      ),
      productWorkspaceCreationRequests: workspaceApiUrl(
        "/api/v1/product-workspace-creation-requests",
        workspace,
      ),
      ideaToSpecRepairRerunRequests: workspaceApiUrl(
        "/api/v1/idea-to-spec-repair-rerun-requests",
        workspace,
      ),
      ideaToSpecCandidateApprovalIntents: workspaceApiUrl(
        "/api/v1/idea-to-spec-candidate-approval-intents",
        workspace,
      ),
      projectLocalOntologyReviewDecisions: workspaceApiUrl(
        "/api/v1/project-local-ontology-review-decisions",
        workspace,
      ),
      ontologyWorkbench: workspaceApiUrl("/api/v1/ontology-workbench", workspace),
      practicalOntology: workspaceApiUrl("/api/v1/practical-ontology", workspace),
      ontologyReviewDashboard: workspaceApiUrl(
        "/api/v1/ontology-review-dashboard",
        workspace,
      ),
      ontologyComplianceReview: workspaceApiUrl(
        "/api/v1/ontology-compliance-review",
        workspace,
      ),
      ontologyOwnerDecisionReview: workspaceApiUrl(
        "/api/v1/ontology-owner-decision-review",
        workspace,
      ),
      artifacts: workspaceApiUrl("/api/v1/artifacts", workspace),
      artifactContent: workspaceApiUrl("/api/v1/artifacts/content", workspace),
      specpmLifecycle: workspaceApiUrl("/api/v1/specpm/lifecycle", workspace),
    }),
    [workspace],
  );
  const feedState = useRecentChanges({
    url: workspaceApiUrls.specActivity,
    refreshKey: runsWatchVersion,
  });
  const workState = useImplementationWorkIndex({
    url: workspaceApiUrls.implementationWork,
    refreshKey: runsWatchVersion,
  });
  const proposalTraceState = useProposalSpecTraceIndex({
    url: workspaceApiUrls.proposalTrace,
    refreshKey: runsWatchVersion,
  });
  const proposalIndexState = useProposalIndex({
    url: workspaceApiUrls.proposals,
    refreshKey: runsWatchVersion,
  });
  const metricsIndexState = useMetricsIndex({
    url: workspaceApiUrls.metrics,
    refreshKey: runsWatchVersion,
  });
  const agentSurfacesState = useAgentSurfaces({
    url: workspaceApiUrls.agentSurfaces,
    refreshKey: runsWatchVersion,
  });
  const ideaToSpecWorkspaceState = useIdeaToSpecWorkspace({
    url: workspaceApiUrls.ideaToSpecWorkspace,
    refreshKey: `${runsWatchVersion}:${ideaToSpecWorkspaceRefreshKey}`,
  });
  const productWorkspaceCreationRequests = useProductWorkspaceCreationRequests({
    url: workspaceApiUrls.productWorkspaceCreationRequests,
    writeUrl: "/api/v1/product-workspace-creation-requests",
    refreshKey: runsWatchVersion,
  });
  const closeNewWorkspaceWizard = useCallback(() => {
    if (productWorkspaceCreationRequests.pending) return;
    setNewIdeaWorkspaceWizardOpen(false);
  }, [productWorkspaceCreationRequests.pending]);
  useEffect(() => {
    if (newIdeaWorkspaceWizardOpen) {
      wasNewIdeaWorkspaceWizardOpenRef.current = true;
      window.setTimeout(() => newIdeaWorkspaceFirstFieldRef.current?.focus(), 0);
      return;
    }
    if (!wasNewIdeaWorkspaceWizardOpenRef.current) return;
    wasNewIdeaWorkspaceWizardOpenRef.current = false;
    window.setTimeout(() => newIdeaWorkspaceLauncherButtonRef.current?.focus(), 0);
  }, [newIdeaWorkspaceWizardOpen]);
  const handleNewWorkspaceWizardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLFormElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNewWorkspaceWizard();
        return;
      }
      if (event.key !== "Tab") return;
      const wizard = newIdeaWorkspaceWizardRef.current;
      if (wizard === null) return;
      const focusable = Array.from(
        wizard.querySelectorAll<HTMLElement>(
          [
            "button:not([disabled])",
            "input:not([disabled])",
            "textarea:not([disabled])",
            "select:not([disabled])",
            "a[href]",
            '[tabindex]:not([tabindex="-1"])',
          ].join(", "),
        ),
      ).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeNewWorkspaceWizard],
  );
  const ontologyWorkbenchState = useOntologyWorkbench({
    url: workspaceApiUrls.ontologyWorkbench,
    refreshKey: runsWatchVersion,
  });
  const practicalOntologyState = usePracticalOntology({
    url: workspaceApiUrls.practicalOntology,
    refreshKey: runsWatchVersion,
  });
  const ontologyReviewDashboardState = useOntologyReviewDashboard({
    url: workspaceApiUrls.ontologyReviewDashboard,
    refreshKey: runsWatchVersion,
  });
  const ontologyComplianceReviewState = useOntologyComplianceReview({
    url: workspaceApiUrls.ontologyComplianceReview,
    refreshKey: runsWatchVersion,
  });
  const ontologyOwnerDecisionReviewState = useOntologyOwnerDecisionReview({
    url: workspaceApiUrls.ontologyOwnerDecisionReview,
    refreshKey: runsWatchVersion,
  });
  const artifactCatalogState = useArtifactCatalog({
    url: workspaceApiUrls.artifacts,
    refreshKey: runsWatchVersion,
  });
  const capabilitiesState = useSpecSpaceCapabilities();
  const specpmRegistryState = useSpecPMRegistrySummary();
  const specGraphState = useSpecGraph({
    url: workspaceApiUrls.specGraph,
    refreshKey: runsWatchVersion,
  });
  const specpmLifecycleState = useSpecPMLifecycleBadges({
    enabled: shouldUseLocalSpecPMLifecycle(apiDeploymentState),
    url: workspaceApiUrls.specpmLifecycle,
    refreshKey: runsWatchVersion,
  });
  const deploymentStatus = describeDeploymentStatus(uiDeploymentInfo, apiDeploymentState);
  const hyperpromptCompileCapability =
    capabilitiesState.kind === "ok"
      ? capabilitiesState.data.diagnostics.hyperpromptCompile
      : null;

  const feedStatus = describeLive(feedState, {
    items: "events",
    itemSingular: "event",
    emptyLive: "No activity recorded yet",
  });
  const workStatus = describeLive(workState, {
    items: "items",
    itemSingular: "item",
    emptyLive: "No work items emitted yet",
  });
  const proposalTraceStatus = describeLive(proposalTraceState, {
    items: "entries",
    itemSingular: "entry",
    emptyLive: "No proposal trace entries yet",
  });

  const liveEntries =
    feedState.kind === "ok" ? feedState.data.entries : SAMPLE_ENTRIES;
  const promptOverlaySummary =
    feedState.kind === "ok" ? feedState.data.viewer_projection.prompt_overlay : undefined;
  const liveWorkItems =
    workState.kind === "ok" ? workState.data.entries : SAMPLE_WORK_ITEMS;
  const liveProposalTraceIndex =
    proposalTraceState.kind === "ok" ? proposalTraceState.data : null;
  const liveProposalTraceEntries = proposalTraceEntriesForPanel(
    proposalTraceState,
    SAMPLE_PROPOSAL_TRACES,
  );
  const sourceDelta =
    workState.kind === "ok" ? workState.data.source_delta_snapshot : null;
  const sourceDeltaDescription = describeSourceDeltaSnapshot(sourceDelta);
  const workEmptyDetail =
    workState.kind === "ok"
      ? `Artifact is live; ${sourceDeltaDescription}. No coding handoff has been emitted.`
      : workStatus.emptyMessage;
  const artifactDiagnostics = [
    describeArtifact({
      id: "recent",
      label: "Recent changes",
      endpoint: "/api/v1/spec-activity",
      state: feedState,
      liveCount: feedState.kind === "ok" ? feedState.data.entry_count : 0,
      sampleCount: SAMPLE_ENTRIES.length,
      noun: { singular: "event", plural: "events" },
      emptyDetail: "Artifact is live but contains no activity events.",
    }),
    describeArtifact({
      id: "work",
      label: "Implementation work",
      endpoint: "/api/v1/implementation-work-index",
      state: workState,
      liveCount: workState.kind === "ok" ? workState.data.entry_count : 0,
      sampleCount: SAMPLE_WORK_ITEMS.length,
      noun: { singular: "item", plural: "items" },
      emptyDetail: workEmptyDetail,
    }),
    describeArtifact({
      id: "proposal-trace",
      label: "Proposal trace",
      endpoint: "/api/v1/proposal-spec-trace-index",
      state: proposalTraceState,
      liveCount: proposalTraceState.kind === "ok" ? proposalTraceState.data.entry_count : 0,
      sampleCount: SAMPLE_PROPOSAL_TRACES.length,
      noun: { singular: "entry", plural: "entries" },
      emptyDetail: "Artifact is live but contains no proposal trace entries.",
    }),
    describeArtifact({
      id: "ontology-review",
      label: "Ontology review",
      endpoint: "/api/v1/ontology-review-dashboard",
      state: ontologyReviewDashboardState,
      liveCount:
        ontologyReviewDashboardState.kind === "ok"
          ? ontologyReviewDashboardState.data.statusSummary.evidenceEntryCount
          : 0,
      sampleCount: 0,
      noun: { singular: "entry", plural: "entries" },
      emptyDetail: "Artifact is live but contains no evidence entries.",
    }),
    describeArtifact({
      id: "ontology-compliance",
      label: "Ontology compliance",
      endpoint: "/api/v1/ontology-compliance-review",
      state: ontologyComplianceReviewState,
      liveCount:
        ontologyComplianceReviewState.kind === "ok"
          ? ontologyComplianceReviewState.data.summary.specCount
          : 0,
      sampleCount: 0,
      noun: { singular: "spec", plural: "specs" },
      emptyDetail: "Artifact is live; all reported specs pass ontology compliance checks.",
    }),
    describeArtifact({
      id: "ontology-owner-decisions",
      label: "Ontology owner decisions",
      endpoint: "/api/v1/ontology-owner-decision-review",
      state: ontologyOwnerDecisionReviewState,
      liveCount:
        ontologyOwnerDecisionReviewState.kind === "ok"
          ? ontologyOwnerDecisionReviewState.data.summary.previewCount
          : 0,
      sampleCount: 0,
      noun: { singular: "decision", plural: "decisions" },
      emptyDetail: "Artifact is live but contains no owner decision previews.",
    }),
  ] as const;
  const capabilityDiagnostics = describeCapabilityDiagnostics(capabilitiesState);
  const workspaceLaneLabel = WORKSPACE_LANE_LABELS[workspace.workflowLane];
  const workspaceRoleLabel = WORKSPACE_ROLE_LABELS[workspace.targetRepositoryRole];
  const liveStatusTooltip = [
    `Workspace: ${workspace.displayName}; ${workspaceLaneLabel}; ${workspaceRoleLabel}`,
    deploymentStatus.title,
    ...artifactDiagnostics.map(
      (artifact) => `${artifact.label}: ${artifact.status}; ${artifact.detail}`,
    ),
    artifactCatalogState.kind === "ok"
      ? `Published artifact catalog: live; ${artifactCatalogState.data.summary.artifactCount} files`
      : `Published artifact catalog: ${artifactCatalogState.kind}`,
    ...capabilityDiagnostics.map(
      (artifact) => `${artifact.label}: ${artifact.status}; ${artifact.detail}`,
    ),
  ].join("\n");

  // Spec search narrows the feed before tone bucketing, so chip counts show
  // the tone distribution inside the active spec/path query.
  const specSearch = useSpecSearch();
  const specMatchedEntries = filterBySpecQuery(liveEntries, specSearch.query);

  // For "ok" with live data, drop the static demo timestamps so relative time
  // reflects the real artifact mtime story.
  const now = feedState.kind === "ok" ? undefined : SAMPLE_NOW;
  const timelineFilterActive = hasRecentTimelineFilter(recentTimelineFilter);
  const timelineFilteredEntries = useMemo(
    () =>
      filterRecentChangesByTimeline(
        specMatchedEntries,
        specGraphState.data.graph.nodes,
        recentTimelineFilter,
        now,
      ),
    [now, recentTimelineFilter, specGraphState.data.graph.nodes, specMatchedEntries],
  );

  // Tone filter is local UI state — lifted from inside the panel because the
  // chip bar lives above the panel header. Empty selection = no filter.
  const toneFilter = useToneFilter();
  const filteredEntries = filterByTone(
    timelineFilteredEntries.entries,
    toneFilter.selected,
  );

  const feedCaption =
    feedState.kind === "ok"
      ? toneFilter.hasAny || specSearch.hasQuery || timelineFilterActive
        ? `${filteredEntries.length} of ${liveEntries.length} events · live · filtered`
        : `${liveEntries.length} events · live`
      : feedStatus.caption;
  const feedEmptyMessage =
    specSearch.hasQuery && specMatchedEntries.length === 0
      ? "No events match that spec search"
      : timelineFilterActive && timelineFilteredEntries.entries.length === 0
        ? "No events match the current timeline filter"
      : toneFilter.hasAny && filteredEntries.length === 0
        ? "No events match the current filter"
        : feedStatus.emptyMessage;
  const workCaption =
    workState.kind === "ok"
      ? `${liveWorkItems.length} items · live`
      : workStatus.caption;
  const proposalTraceCaption =
    proposalTraceState.kind === "ok"
      ? `${proposalTraceState.data.entry_count} entries · live`
      : proposalTraceStatus.caption;
  const proposalIndexCaption =
    proposalIndexState.kind === "ok"
      ? `${proposalIndexState.data.entry_count} proposals · readonly`
      : proposalIndexState.kind;
  const metricsIndexCaption =
    metricsIndexState.kind === "ok"
      ? `${metricsIndexState.data.entry_count} metrics · readonly`
      : metricsIndexState.kind;
  const agentSurfacesCaption =
    agentSurfacesState.kind === "ok"
      ? `${agentSurfacesState.data.entryCount} surfaces · ${agentSurfacesState.data.summary.handoffStatus}`
      : agentSurfacesState.kind;
  const ideaToSpecWorkspaceCaption =
    ideaToSpecWorkspaceState.kind === "ok"
      ? `${ideaToSpecWorkspaceState.data.summary.candidateNodeCount} nodes · ${ideaToSpecWorkspaceState.data.summary.repairActionCount} repairs · ${ideaToSpecWorkspaceState.data.summary.status}`
      : ideaToSpecWorkspaceState.kind;
  const practicalOntologyCaption =
    practicalOntologyState.kind === "ok"
      ? `${practicalOntologyState.data.summary.termCount} terms · ${practicalOntologyState.data.summary.topologyEdgeCount} topology · ${practicalOntologyState.data.summary.proposalReferenceCount} refs`
      : practicalOntologyState.kind;
  const ontologyWorkbenchCaption =
    ontologyWorkbenchState.kind === "ok"
      ? `${ontologyWorkbenchState.data.summary.termCount} terms · ${ontologyWorkbenchState.data.summary.gapGroupCount} gaps · ${ontologyWorkbenchState.data.summary.complianceFindingCount} findings`
      : ontologyWorkbenchState.kind;
  const ontologyReviewDashboardCaption =
    ontologyReviewDashboardState.kind === "ok"
      ? `${ontologyReviewDashboardState.data.statusSummary.evidenceEntryCount} entries · ${ontologyReviewDashboardState.data.statusSummary.status}`
      : ontologyReviewDashboardState.kind;
  const ontologyComplianceReviewCaption =
    ontologyComplianceReviewState.kind === "ok"
      ? `${ontologyComplianceReviewState.data.summary.specCount} specs · ${ontologyComplianceReviewState.data.summary.findingCount} findings`
      : ontologyComplianceReviewState.kind;
  const ontologyOwnerDecisionReviewCaption =
    ontologyOwnerDecisionReviewState.kind === "ok"
      ? `${ontologyOwnerDecisionReviewState.data.summary.previewCount} decisions · ${ontologyOwnerDecisionReviewState.data.summary.status}`
      : ontologyOwnerDecisionReviewState.kind;
  const artifactAttentionCount =
    artifactDiagnostics.filter((artifact) => artifact.tone !== "live").length +
    (artifactCatalogState.kind === "http-error" ||
    artifactCatalogState.kind === "network-error" ||
    artifactCatalogState.kind === "parse-error"
      ? 1
      : 0);
  const artifactCaption =
    artifactCatalogState.kind === "ok"
      ? `${artifactCatalogState.data.summary.artifactCount} files · ${artifactCatalogState.data.summary.ontologyArtifactCount} ontology`
      : `runs tick ${runsWatchVersion}`;
  const lifecycleBadgesByNode: ReadonlyMap<string, SpecPMLifecycleBadge> | undefined =
    specpmLifecycleState.kind === "ok"
      ? specpmLifecycleState.badgesByNode
      : undefined;
  const resolveSpecRef = useMemo(
    () => createSpecNodeRefResolver(specGraphState.data.graph.nodes),
    [specGraphState.data.graph.nodes],
  );

  const count = filteredEntries.length;
  const selectableSpecNodeIds = useMemo(
    () => new Set(specGraphState.data.graph.nodes.map((node) => node.node_id)),
    [specGraphState.data.graph.nodes],
  );
  const selectionHistorySpecNodeIds = canvasVisibleSpecNodeIds ?? selectableSpecNodeIds;
  const selectedGraphNode = useMemo(
    () =>
      selectedSpecNodeId
        ? (specGraphState.data.graph.nodes.find((node) => node.node_id === selectedSpecNodeId) ?? null)
        : null,
    [selectedSpecNodeId, specGraphState.data.graph.nodes],
  );
  const selectedGraphEdge = useMemo(
    () =>
      selectedSpecEdgeId
        ? (specGraphState.data.graph.edges.find((edge) => edge.edge_id === selectedSpecEdgeId) ?? null)
        : null,
    [selectedSpecEdgeId, specGraphState.data.graph.edges],
  );
  const nodesById = useMemo(
    () => new Map(specGraphState.data.graph.nodes.map((node) => [node.node_id, node])),
    [specGraphState.data.graph.nodes],
  );
  const canvasOverlays = useMemo(
    () =>
      buildSpecGraphCanvasOverlays({
        nodes: specGraphState.data.graph.nodes,
        edges: specGraphState.data.graph.edges,
        proposals: proposalIndexState.kind === "ok" ? proposalIndexState.data.entries : [],
        metrics: metricsIndexState.kind === "ok" ? metricsIndexState.data.entries : [],
      }),
    [
      metricsIndexState,
      proposalIndexState,
      specGraphState.data.graph.edges,
      specGraphState.data.graph.nodes,
    ],
  );
  const clearSpecSelection = () => {
    setSelectedSpecNodeId(null);
    setSelectedSpecEdgeId(null);
    setSelectedSpec(null);
  };
  const selectSpecNodeId = useCallback(
    (nodeId: string) => {
      if (!selectableSpecNodeIds.has(nodeId)) return;
      setSpecSelectionHistory((history) =>
        pushSpecSelectionHistory(history, selectedSpecNodeId, nodeId),
      );
      setSelectedSpecEdgeId(null);
      setSelectedSpecNodeId(nodeId);
    },
    [selectableSpecNodeIds, selectedSpecNodeId],
  );
  const selectSpecNodeIdFromCanvas = useCallback(
    (nodeId: string | null) => {
      if (nodeId) {
        selectSpecNodeId(nodeId);
        return;
      }
      setSelectedSpecNodeId(null);
    },
    [selectSpecNodeId],
  );
  const updateCanvasVisibleSpecNodeIds = useCallback((nodeIds: ReadonlySet<string>) => {
    setCanvasVisibleSpecNodeIds((current) =>
      stringSetsEqual(current, nodeIds) ? current : new Set(nodeIds),
    );
  }, []);
  const goBackSpecSelection = useCallback(() => {
    const step = goBackSpecSelectionHistory(
      specSelectionHistoryRef.current,
      selectedSpecNodeId,
      selectionHistorySpecNodeIds,
    );
    setSpecSelectionHistory(step.history);
    if (step.selectedNodeId && selectionHistorySpecNodeIds.has(step.selectedNodeId)) {
      setSelectedSpecEdgeId(null);
      setSelectedSpecNodeId(step.selectedNodeId);
    }
  }, [selectedSpecNodeId, selectionHistorySpecNodeIds]);
  const goForwardSpecSelection = useCallback(() => {
    const step = goForwardSpecSelectionHistory(
      specSelectionHistoryRef.current,
      selectedSpecNodeId,
      selectionHistorySpecNodeIds,
    );
    setSpecSelectionHistory(step.history);
    if (step.selectedNodeId && selectionHistorySpecNodeIds.has(step.selectedNodeId)) {
      setSelectedSpecEdgeId(null);
      setSelectedSpecNodeId(step.selectedNodeId);
    }
  }, [selectedSpecNodeId, selectionHistorySpecNodeIds]);
  const specSelectionHistoryControls = useMemo(
    () => ({
      canGoBack: specSelectionHistory.back.length > 0,
      canGoForward: specSelectionHistory.forward.length > 0,
      onBack: goBackSpecSelection,
      onForward: goForwardSpecSelection,
    }),
    [
      goBackSpecSelection,
      goForwardSpecSelection,
      specSelectionHistory.back.length,
      specSelectionHistory.forward.length,
    ],
  );
  const selectSpecEdgeId = useCallback((edgeId: string | null) => {
    if (edgeId) {
      setSelectedSpecNodeId(null);
      setSelectedSpec(null);
    }
    setSelectedSpecEdgeId(edgeId);
  }, []);
  const openCanvasOverlayPanel = useCallback(
    (kind: SpecGraphCanvasOverlayKind) => {
      setActiveUtilityPanel(kind === "proposal" ? "proposals" : "metrics");
    },
    [],
  );
  const openNodeOverlayPanel = useCallback(
    (kind: SpecGraphCanvasOverlayKind, nodeId: string) => {
      selectSpecNodeId(nodeId);
      if (kind === "proposal") {
        setProposalContextFilter({ kind: "spec", specId: nodeId });
        setMetricsContextFilter(null);
      } else {
        setMetricsContextFilter({ kind: "node", nodeId });
        setProposalContextFilter(null);
      }
      openCanvasOverlayPanel(kind);
    },
    [openCanvasOverlayPanel, selectSpecNodeId],
  );
  const openEdgeOverlayPanel = useCallback(
    (kind: SpecGraphCanvasOverlayKind, edgeId: string) => {
      selectSpecEdgeId(edgeId);
      if (kind === "metric") {
        setMetricsContextFilter({ kind: "edge", edgeId });
      } else {
        setMetricsContextFilter(null);
      }
      setProposalContextFilter(null);
      openCanvasOverlayPanel(kind);
    },
    [openCanvasOverlayPanel, selectSpecEdgeId],
  );
  const toggleUtilityPanel = (panel: ViewerUtilityPanelId) => {
    if (panel === "proposals") setProposalContextFilter(null);
    if (panel === "metrics") setMetricsContextFilter(null);
    if (panel === "agent-conversation") setAgentConversationPromptSeed(null);
    setActiveUtilityPanel((current) => (current === panel ? null : panel));
  };
  const closeUtilityPanel = () => {
    setActiveUtilityPanel(null);
    setUtilityPanelExpanded(false);
    setAgentConversationPromptSeed(null);
  };
  const setRecentTimelineField = (field: RecentTimelineField) => {
    setRecentTimelineFilter((filter) => withRecentTimelineField(filter, field));
  };
  const setRecentTimelineRange = (range: RecentTimelineRange) => {
    setRecentTimelineFilter((filter) => withRecentTimelineRange(filter, range));
  };
  const setRecentTimelineIncludeUnknown = (includeUnknown: boolean) => {
    setRecentTimelineFilter((filter) => ({ ...filter, includeUnknown }));
  };
  const clearRecentTimelineFilter = () => {
    setRecentTimelineFilter(DEFAULT_RECENT_TIMELINE_FILTER);
  };
  const addSelectedSpecToAgentContext = () => {
    if (!selectedGraphNode) return;
    setAgentContextDraft((draft) =>
      addSpecNodeToAgentContext(draft, selectedGraphNode),
    );
  };
  const addSelectedEdgeToAgentContext = () => {
    if (!selectedGraphEdge) return;
    setAgentContextDraft((draft) =>
      addAgentContextItem(
        draft,
        createSpecEdgeContextItem(edgeContextSource(selectedGraphEdge, nodesById)),
      ),
    );
  };
  const addSelectedGapToAgentContext = (gapKind: AgentContextSpecGapKind) => {
    if (!selectedGraphNode) return;
    const gapCount = selectedSpecGapCount(selectedGraphNode, gapKind);
    if (gapCount <= 0) return;
    setAgentContextDraft((draft) =>
      addAgentContextItem(
        draft,
        createSpecGapContextItem({
          node_id: selectedGraphNode.node_id,
          title: selectedGraphNode.title,
          gap_kind: gapKind,
          gap_count: gapCount,
        }),
      ),
    );
  };
  const removeAgentContextItemByKey = (key: string) => {
    setAgentContextDraft((draft) => removeAgentContextItem(draft, key));
  };
  const clearAgentContext = () => {
    setAgentContextDraft((draft) => clearAgentContextItems(draft));
  };
  const addProposalToAgentContext = (entry: ProposalIndexEntry) => {
    setAgentContextDraft((draft) =>
      addAgentContextItem(draft, createProposalContextItem(entry)),
    );
  };
  const addMetricToAgentContext = (entry: MetricsIndexEntry) => {
    setAgentContextDraft((draft) =>
      addAgentContextItem(draft, createMetricContextItem(entry)),
    );
  };
  const addSpecMarkdownToAgentContext = (source: SpecMarkdownContextSource) => {
    setAgentContextDraft((draft) =>
      addAgentContextItem(draft, createSpecMarkdownContextItem(source)),
    );
  };
  const startConversationFromProposal = (entry: ProposalIndexEntry) => {
    addProposalToAgentContext(entry);
    setAgentConversationPromptSeed(createProposalConversationPromptSeed(entry));
    setActiveUtilityPanel("agent-conversation");
  };
  const startConversationFromMetric = (entry: MetricsIndexEntry) => {
    addMetricToAgentContext(entry);
    setAgentConversationPromptSeed(createMetricConversationPromptSeed(entry));
    setActiveUtilityPanel("agent-conversation");
  };
  const startConversationFromSpecMarkdown = (source: SpecMarkdownContextSource) => {
    addSpecMarkdownToAgentContext(source);
    setAgentConversationPromptSeed(createSpecMarkdownConversationPromptSeed(source));
    setActiveUtilityPanel("agent-conversation");
  };
  const utilityPanelDetails = (() => {
    switch (activeUtilityPanel) {
      case "recent":
        return { title: "Recent changes", caption: feedCaption };
      case "work":
        return { title: "Implementation work", caption: workCaption };
      case "proposal-trace":
        return { title: "Proposal trace", caption: proposalTraceCaption };
      case "proposals":
        return { title: "Proposal viewer", caption: proposalIndexCaption };
      case "metrics":
        return { title: "Metrics viewer", caption: metricsIndexCaption };
      case "agents":
        return { title: "Agent surfaces", caption: agentSurfacesCaption };
      case "idea-to-spec":
        return { title: "Idea-to-spec", caption: ideaToSpecWorkspaceCaption };
      case "ontology-workbench":
        return { title: "Ontology workbench", caption: ontologyWorkbenchCaption };
      case "practical-ontology":
        return { title: "Practical ontology", caption: practicalOntologyCaption };
      case "ontology-review":
        return {
          title: "Ontology review",
          caption: ontologyReviewDashboardCaption,
        };
      case "ontology-compliance":
        return {
          title: "Ontology compliance",
          caption: ontologyComplianceReviewCaption,
        };
      case "ontology-owner-decisions":
        return {
          title: "Ontology owner decisions",
          caption: ontologyOwnerDecisionReviewCaption,
        };
      case "agent-context":
        return {
          title: "Agent context",
          caption: `${agentContextDraft.items.length} items · local draft`,
        };
      case "agent-conversation":
        return {
          title: "Agent conversation",
          caption: "mock runtime · readonly store",
        };
      case "artifacts":
        return { title: "Live artifacts", caption: artifactCaption };
      case "registry":
        return {
          title: "SpecPM registry",
          caption:
            specpmRegistryState.kind === "ok"
              ? `${specpmRegistryState.data.packages.package_count} packages · readonly`
              : specpmRegistryState.kind,
        };
      default:
        return null;
    }
  })();

  useEffect(() => {
    if (!productWorkspace) return;
    setSidebarOpen(true);
    setActiveUtilityPanel("idea-to-spec");
  }, [productWorkspace, workspace.id]);

  useEffect(() => {
    setUtilityPanelExpanded(false);
  }, [activeUtilityPanel]);

  useEffect(() => {
    specSelectionHistoryRef.current = specSelectionHistory;
  }, [specSelectionHistory]);

  useEffect(() => {
    setSpecSelectionHistory((history) =>
      pruneSpecSelectionHistory(history, selectionHistorySpecNodeIds),
    );
  }, [selectionHistorySpecNodeIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (utilityPanelExpanded && event.key === "Escape") {
        const nestedModalDialog = document.querySelector(
          '[role="dialog"][aria-modal="true"]',
        );
        if (nestedModalDialog) return;
        event.preventDefault();
        setUtilityPanelExpanded(false);
        return;
      }
      if (isTextEntryTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === "BracketLeft" && specSelectionHistory.back.length > 0) {
        event.preventDefault();
        goBackSpecSelection();
      }
      if (event.code === "BracketRight" && specSelectionHistory.forward.length > 0) {
        event.preventDefault();
        goForwardSpecSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goBackSpecSelection,
    goForwardSpecSelection,
    specSelectionHistory.back.length,
    specSelectionHistory.forward.length,
    utilityPanelExpanded,
  ]);

  return (
    <div className={styles.root}>
      <SpecGraphCanvas
        state={specGraphState}
        className={[
          styles.canvasLayer,
          sidebarOpen ? styles.canvasLayerWithSidebar : "",
        ]
          .filter(Boolean)
          .join(" ")}
        selectedNodeId={selectedSpecNodeId}
        selectedEdgeId={selectedSpecEdgeId}
        specNodeDetailUrl={workspaceApiUrls.specNodes}
        lifecycleBadgesByNode={lifecycleBadgesByNode}
        overlays={canvasOverlays}
        onSelectedNodeIdChange={selectSpecNodeIdFromCanvas}
        onSelectedEdgeIdChange={selectSpecEdgeId}
        onNodeOverlayClick={openNodeOverlayPanel}
        onEdgeOverlayClick={openEdgeOverlayPanel}
        onSelectionChange={setSelectedSpec}
        onVisibleNodeIdsChange={updateCanvasVisibleSpecNodeIds}
      />

      {sidebarOpen ? (
        <aside className={styles.sidebarRail} aria-label="SpecSpace Sidebar">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarBrandMark}>
              <SidebarLogo />
              <span className={styles.sidebarBrand}>SpecSpace</span>
            </span>
            <PanelBtnRow
              className={styles.sidebarHeaderActions}
              aria-label="Selected spec navigation"
            >
              <SelectionHistoryButtons {...specSelectionHistoryControls} />
            </PanelBtnRow>
            <button
              title="Close Sidebar"
              aria-label="Close Sidebar"
              className={styles.closeButton}
              type="button"
              onClick={() => setSidebarOpen(false)}
            >
              Close
            </button>
          </div>

          <section className={styles.workspaceLauncher} aria-label="Workspace launcher">
            <div className={styles.workspaceLauncherHeader}>
              <label
                className={styles.workspaceLauncherLabel}
                htmlFor="workspace-route-select"
              >
                Workspaces
              </label>
              <button
                ref={newIdeaWorkspaceLauncherButtonRef}
                className={styles.workspaceAddButton}
                type="button"
                aria-label="New workspace"
                title="New workspace"
                onClick={() => setNewIdeaWorkspaceWizardOpen(true)}
              >
                +
              </button>
            </div>
            <select
              id="workspace-route-select"
              className={styles.workspaceSelect}
              value={workspace.route}
              onChange={(event) => {
                const route = event.target.value;
                if (route && route !== workspace.route) window.location.assign(route);
              }}
            >
              {workspaceSwitcherItems.map((item) => (
                <option key={item.id} value={item.route}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </section>
          <div className={styles.workspaceMeta}>
            <span>{workspaceLaneLabel}</span>
            <span>{workspaceRoleLabel}</span>
          </div>

          <PanelBtnRow
            className={styles.sidebarDock}
            role="toolbar"
            aria-label="Utility panels"
          >
            {!productWorkspace ? (
              <>
                <PanelBtn
                  title="Open Recent changes"
                  aria-label="Open Recent changes"
                  active={activeUtilityPanel === "recent"}
                  badge={count}
                  onClick={() => toggleUtilityPanel("recent")}
                >
                  ◷
                </PanelBtn>
                <PanelBtn
                  title="Open Implementation work"
                  aria-label="Open Implementation work"
                  active={activeUtilityPanel === "work"}
                  badge={liveWorkItems.length}
                  onClick={() => toggleUtilityPanel("work")}
                >
                  ▤
                </PanelBtn>
                <PanelBtn
                  title="Open Proposal viewer"
                  aria-label="Open Proposal viewer"
                  active={activeUtilityPanel === "proposals"}
                  badge={
                    proposalIndexState.kind === "ok"
                      ? proposalIndexState.data.entry_count
                      : undefined
                  }
                  onClick={() => toggleUtilityPanel("proposals")}
                >
                  ◈
                </PanelBtn>
                <PanelBtn
                  title="Open Metrics viewer"
                  aria-label="Open Metrics viewer"
                  active={activeUtilityPanel === "metrics"}
                  badge={
                    metricsIndexState.kind === "ok"
                      ? metricsIndexState.data.entry_count
                      : undefined
                  }
                  onClick={() => toggleUtilityPanel("metrics")}
                >
                  ▥
                </PanelBtn>
                <PanelBtn
                  title="Open Agent surfaces"
                  aria-label="Open Agent surfaces"
                  active={activeUtilityPanel === "agents"}
                  badge={
                    agentSurfacesState.kind === "ok"
                      ? agentSurfacesState.data.entryCount
                      : undefined
                  }
                  onClick={() => toggleUtilityPanel("agents")}
                >
                  ⎈
                </PanelBtn>
              </>
            ) : null}
            <PanelBtn
              title="Open Idea-to-Spec workspace"
              aria-label="Open Idea-to-Spec workspace"
              active={activeUtilityPanel === "idea-to-spec"}
              badge={
                ideaToSpecWorkspaceState.kind === "ok"
                  ? ideaToSpecWorkspaceState.data.summary.repairActionCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("idea-to-spec")}
            >
              ✦
            </PanelBtn>
            <PanelBtn
              title="Open Ontology workbench"
              aria-label="Open Ontology workbench"
              active={activeUtilityPanel === "ontology-workbench"}
              badge={
                ontologyWorkbenchState.kind === "ok"
                  ? ontologyWorkbenchState.data.summary.gapGroupCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("ontology-workbench")}
            >
              ⌾
            </PanelBtn>
            <PanelBtn
              title="Open Practical ontology"
              aria-label="Open Practical ontology"
              active={activeUtilityPanel === "practical-ontology"}
              badge={
                practicalOntologyState.kind === "ok"
                  ? practicalOntologyState.data.summary.termCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("practical-ontology")}
            >
              ⌘
            </PanelBtn>
            <PanelBtn
              title="Open Ontology review dashboard"
              aria-label="Open Ontology review dashboard"
              active={activeUtilityPanel === "ontology-review"}
              badge={
                ontologyReviewDashboardState.kind === "ok"
                  ? ontologyReviewDashboardState.data.statusSummary.evidenceEntryCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("ontology-review")}
            >
              ⌬
            </PanelBtn>
            <PanelBtn
              title="Open Ontology compliance"
              aria-label="Open Ontology compliance"
              active={activeUtilityPanel === "ontology-compliance"}
              badge={
                ontologyComplianceReviewState.kind === "ok"
                  ? ontologyComplianceReviewState.data.summary.findingCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("ontology-compliance")}
            >
              ✓
            </PanelBtn>
            <PanelBtn
              title="Open Ontology owner decisions"
              aria-label="Open Ontology owner decisions"
              active={activeUtilityPanel === "ontology-owner-decisions"}
              badge={
                ontologyOwnerDecisionReviewState.kind === "ok"
                  ? ontologyOwnerDecisionReviewState.data.summary.previewCount
                  : undefined
              }
              onClick={() => toggleUtilityPanel("ontology-owner-decisions")}
            >
              ◇
            </PanelBtn>
            {!productWorkspace ? (
              <>
                <PanelBtn
                  title="Open Agent context"
                  aria-label="Open Agent context"
                  active={activeUtilityPanel === "agent-context"}
                  badge={agentContextDraft.items.length}
                  onClick={() => toggleUtilityPanel("agent-context")}
                >
                  ⊕
                </PanelBtn>
                <PanelBtn
                  title="Open Agent conversation"
                  aria-label="Open Agent conversation"
                  active={activeUtilityPanel === "agent-conversation"}
                  badge={agentContextDraft.items.length}
                  onClick={() => toggleUtilityPanel("agent-conversation")}
                >
                  ◌
                </PanelBtn>
                <PanelBtn
                  title="Open Proposal trace"
                  aria-label="Open Proposal trace"
                  active={activeUtilityPanel === "proposal-trace"}
                  badge={
                    proposalTraceState.kind === "ok"
                      ? proposalTraceState.data.entry_count
                      : liveProposalTraceEntries.length
                  }
                  onClick={() => toggleUtilityPanel("proposal-trace")}
                >
                  ◇
                </PanelBtn>
              </>
            ) : null}
            <PanelBtn
              title="Open Live artifacts"
              aria-label="Open Live artifacts"
              active={activeUtilityPanel === "artifacts"}
              badge={artifactAttentionCount}
              onClick={() => toggleUtilityPanel("artifacts")}
            >
              ◎
            </PanelBtn>
            {!productWorkspace ? (
              <PanelBtn
                title="Open SpecPM registry"
                aria-label="Open SpecPM registry"
                active={activeUtilityPanel === "registry"}
                badge={
                  specpmRegistryState.kind === "ok"
                    ? specpmRegistryState.data.packages.package_count
                    : undefined
                }
                onClick={() => toggleUtilityPanel("registry")}
              >
                ⌁
              </PanelBtn>
            ) : null}
          </PanelBtnRow>

          {!productWorkspace ? (
            <SpecNodeNavigator
              nodes={specGraphState.data.graph.nodes}
              selectedNodeId={selectedSpecNodeId}
              source={specGraphState.source}
              onSelectNodeId={selectSpecNodeId}
            />
          ) : null}
        </aside>
      ) : null}

      {newIdeaWorkspaceWizardOpen ? (
        <div
          className={styles.newWorkspaceWizardOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-workspace-wizard-title"
        >
          <form
            ref={newIdeaWorkspaceWizardRef}
            className={styles.newWorkspaceWizard}
            aria-label="New workspace wizard"
            onKeyDown={handleNewWorkspaceWizardKeyDown}
            onSubmit={(event) => {
              event.preventDefault();
              if (!newIdeaWorkspaceInput.trim()) return;
              void productWorkspaceCreationRequests
                .saveRequest({
                  workspaceId: newIdeaWorkspaceSlug,
                  displayName: newIdeaWorkspaceInput.trim(),
                  route: newIdeaWorkspaceRoute,
                  rootIntentSummary: newIdeaWorkspaceRootIntent.trim() || null,
                  operatorRef: "operator://specspace-local",
                })
                .then((saved) => {
                  const savedRoute = saved ? saved.activeRequest?.route : null;
                  if (savedRoute) window.location.assign(savedRoute);
                });
            }}
          >
            <header className={styles.newWorkspaceWizardHeader}>
              <div>
                <p className={styles.newWorkspaceWizardKicker}>Product workspace</p>
                <h2
                  id="new-workspace-wizard-title"
                  className={styles.newWorkspaceWizardTitle}
                >
                  New workspace
                </h2>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={closeNewWorkspaceWizard}
                disabled={productWorkspaceCreationRequests.pending}
              >
                Close
              </button>
            </header>

            <div className={styles.newWorkspaceWizardGrid}>
              <section className={styles.newWorkspaceWizardStep}>
                <span className={styles.newWorkspaceStepIndex}>1</span>
                <label
                  className={styles.newWorkspaceWizardLabel}
                  htmlFor="new-idea-workspace-input"
                >
                  Workspace display name
                </label>
                <input
                  ref={newIdeaWorkspaceFirstFieldRef}
                  id="new-idea-workspace-input"
                  className={styles.newWorkspaceInput}
                  type="text"
                  value={newIdeaWorkspaceInput}
                  placeholder="Cash Flow Control"
                  autoComplete="off"
                  onChange={(event) => setNewIdeaWorkspaceInput(event.target.value)}
                />
                <p
                  className={styles.newWorkspaceHint}
                  data-testid="new-idea-workspace-route"
                >
                  {newIdeaWorkspaceRoute !== null
                    ? newIdeaWorkspaceRoute
                    : newIdeaWorkspaceInput.trim()
                      ? "SpecSpace will ask the backend to allocate a safe route."
                      : "Enter a workspace name to preview or allocate a route."}
                </p>
              </section>

              <section className={styles.newWorkspaceWizardStep}>
                <span className={styles.newWorkspaceStepIndex}>2</span>
                <label
                  className={styles.newWorkspaceWizardLabel}
                  htmlFor="new-idea-workspace-root-intent"
                >
                  Initial idea
                </label>
                <textarea
                  id="new-idea-workspace-root-intent"
                  className={styles.newWorkspaceTextarea}
                  value={newIdeaWorkspaceRootIntent}
                  placeholder="Describe the product idea or context."
                  onChange={(event) =>
                    setNewIdeaWorkspaceRootIntent(event.target.value)
                  }
                />
                <p className={styles.newWorkspaceHint}>
                  Stored as operator-owned request context; raw product work still
                  enters the idea-to-spec intake after initialization.
                </p>
              </section>

              <section className={styles.newWorkspaceWizardStep}>
                <span className={styles.newWorkspaceStepIndex}>3</span>
                <h3 className={styles.newWorkspaceWizardStepTitle}>
                  Creation boundary
                </h3>
                <p className={styles.newWorkspaceWizardCopy}>
                  SpecSpace records a workspace creation request. Platform owns
                  controlled initialization, and SpecGraph/Git/Ontology are not
                  mutated from the browser.
                </p>
                <dl className={styles.newWorkspaceBoundaryList}>
                  <div>
                    <dt>Browser execution</dt>
                    <dd>false</dd>
                  </div>
                  <div>
                    <dt>SpecGraph mutation</dt>
                    <dd>false</dd>
                  </div>
                  <div>
                    <dt>Git writes</dt>
                    <dd>false</dd>
                  </div>
                </dl>
              </section>
            </div>

            {productWorkspaceCreationRequests.saveError ? (
              <p className={styles.newWorkspaceError}>
                {workspaceCreationSaveErrorMessage(
                  productWorkspaceCreationRequests.saveError,
                )}
              </p>
            ) : null}

            <footer className={styles.newWorkspaceWizardActions}>
              <button
                className={styles.newWorkspaceSecondaryButton}
                type="button"
                onClick={closeNewWorkspaceWizard}
                disabled={productWorkspaceCreationRequests.pending}
              >
                Cancel
              </button>
              <button
                className={styles.newWorkspacePrimaryButton}
                type="submit"
                disabled={
                  !newIdeaWorkspaceInput.trim() ||
                  productWorkspaceCreationRequests.pending
                }
              >
                {productWorkspaceCreationRequests.pending
                  ? "Creating request"
                  : "Create workspace request"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {utilityPanelDetails ? (
        <aside
          className={[
            styles.utilityRail,
            selectedSpec || selectedGraphEdge ? styles.utilityRailWithInspector : "",
            utilityPanelExpanded ? styles.utilityRailExpanded : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={utilityPanelDetails.title}
          role={utilityPanelExpanded ? "dialog" : undefined}
        >
          <UtilityPanelHeader
            title={utilityPanelDetails.title}
            caption={utilityPanelDetails.caption}
            expanded={utilityPanelExpanded}
            onToggleExpanded={() => setUtilityPanelExpanded((expanded) => !expanded)}
            onClose={closeUtilityPanel}
          />

          {activeUtilityPanel === "recent" ? (
            <RecentActivitySurface
              entries={filteredEntries}
              now={now}
              caption={feedCaption}
              emptyMessage={feedEmptyMessage}
              search={{
                query: specSearch.query,
                onQueryChange: specSearch.setQuery,
                onClear: specSearch.clear,
                resultCount: specMatchedEntries.length,
                totalCount: liveEntries.length,
              }}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
              tone={{
                entries: timelineFilteredEntries.entries,
                selected: toneFilter.selected,
                onToggle: toneFilter.toggle,
                onClear: toneFilter.clear,
              }}
              timeline={{
                filter: recentTimelineFilter,
                resultCount: timelineFilteredEntries.entries.length,
                totalCount: timelineFilteredEntries.totalCount,
                knownCount: timelineFilteredEntries.knownCount,
                unknownCount: timelineFilteredEntries.unknownCount,
                onFieldChange: setRecentTimelineField,
                onRangeChange: setRecentTimelineRange,
                onIncludeUnknownChange: setRecentTimelineIncludeUnknown,
                onClear: clearRecentTimelineFilter,
              }}
              promptOverlay={promptOverlaySummary}
            />
          ) : null}

          {activeUtilityPanel === "work" ? (
            <ImplementationWorkPanel
              items={liveWorkItems}
              caption={workCaption}
              emptyMessage={
                workState.kind === "ok" && liveWorkItems.length === 0
                  ? workEmptyDetail
                  : workStatus.emptyMessage
              }
              className={styles.workPanel}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
            />
          ) : null}

          {activeUtilityPanel === "proposal-trace" ? (
            <ProposalTracePanel
              index={liveProposalTraceIndex}
              entries={liveProposalTraceEntries}
              caption={proposalTraceCaption}
              emptyMessage={proposalTraceStatus.emptyMessage}
              className={styles.proposalTracePanel}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
            />
          ) : null}

          {activeUtilityPanel === "proposals" ? (
            <ProposalViewerPanel
              state={proposalIndexState}
              resolveSpecRef={resolveSpecRef}
              contextFilter={proposalContextFilter}
              onSpecIdClick={selectSpecNodeId}
              onClearContextFilter={() => setProposalContextFilter(null)}
              onAddProposalToAgentContext={addProposalToAgentContext}
              onStartConversationFromProposal={startConversationFromProposal}
            />
          ) : null}

          {activeUtilityPanel === "metrics" ? (
            <MetricsViewerPanel
              state={metricsIndexState}
              resolveSpecRef={resolveSpecRef}
              contextFilter={metricsContextFilter}
              onSpecIdClick={selectSpecNodeId}
              onClearContextFilter={() => setMetricsContextFilter(null)}
              onAddMetricToAgentContext={addMetricToAgentContext}
              onStartConversationFromMetric={startConversationFromMetric}
            />
          ) : null}

          {activeUtilityPanel === "agents" ? (
            <AgentSurfacesPanel state={agentSurfacesState} />
          ) : null}

          {activeUtilityPanel === "idea-to-spec" ? (
            <IdeaToSpecWorkspacePanel
              state={ideaToSpecWorkspaceState}
              repairDraftsUrl={workspaceApiUrls.ideaToSpecRepairDrafts}
              intakeClarificationAnswersUrl={
                workspaceApiUrls.ideaToSpecIntakeClarificationAnswers
              }
              realIdeaEntryRequestsUrl={workspaceApiUrls.realIdeaEntryRequests}
              realIdeaIntakeExecutionRequestsUrl={
                workspaceApiUrls.realIdeaIntakeExecutionRequests
              }
              realIdeaAnswerContinuationExecutionRequestsUrl={
                workspaceApiUrls.realIdeaAnswerContinuationExecutionRequests
              }
              repairRerunRequestsUrl={workspaceApiUrls.ideaToSpecRepairRerunRequests}
              candidateApprovalIntentsUrl={workspaceApiUrls.ideaToSpecCandidateApprovalIntents}
              projectLocalOntologyReviewDecisionsUrl={
                workspaceApiUrls.projectLocalOntologyReviewDecisions
              }
              repairRerunRequestsRefreshKey={runsWatchVersion}
              onWorkspaceRefreshRequest={() =>
                setIdeaToSpecWorkspaceRefreshKey((current) => current + 1)
              }
            />
          ) : null}

          {activeUtilityPanel === "ontology-workbench" ? (
            <OntologyWorkbenchPanel state={ontologyWorkbenchState} />
          ) : null}

          {activeUtilityPanel === "practical-ontology" ? (
            <PracticalOntologyPanel state={practicalOntologyState} />
          ) : null}

          {activeUtilityPanel === "ontology-review" ? (
            <OntologyReviewDashboardPanel state={ontologyReviewDashboardState} />
          ) : null}

          {activeUtilityPanel === "ontology-compliance" ? (
            <OntologyComplianceReviewPanel state={ontologyComplianceReviewState} />
          ) : null}

          {activeUtilityPanel === "ontology-owner-decisions" ? (
            <OntologyOwnerDecisionReviewPanel state={ontologyOwnerDecisionReviewState} />
          ) : null}

          {activeUtilityPanel === "agent-context" ? (
            <AgentContextPanel
              draft={agentContextDraft}
              selectedNode={selectedGraphNode}
              selectedEdge={selectedGraphEdge}
              resolveSpecRef={resolveSpecRef}
              onAddSelectedSpec={addSelectedSpecToAgentContext}
              onAddSelectedEdge={addSelectedEdgeToAgentContext}
              onAddSelectedGap={addSelectedGapToAgentContext}
              onRemoveItem={removeAgentContextItemByKey}
              onClear={clearAgentContext}
              onOpenConversation={() => {
                setAgentConversationPromptSeed(null);
                setActiveUtilityPanel("agent-conversation");
              }}
            />
          ) : null}

          {activeUtilityPanel === "agent-conversation" ? (
            <AgentConversationPanel
              runtime={agentConversationRuntime}
              draft={agentContextDraft}
              promptSeed={agentConversationPromptSeed}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={selectSpecNodeId}
              onRemoveContextItem={removeAgentContextItemByKey}
            />
          ) : null}

          {activeUtilityPanel === "artifacts" ? (
            <LiveArtifactStatusPanel
              diagnostics={artifactDiagnostics}
              capabilityDiagnostics={capabilityDiagnostics}
              artifactCatalogState={artifactCatalogState}
              artifactContentUrl={workspaceApiUrls.artifactContent}
              runsWatchVersion={runsWatchVersion}
              showHeader={false}
            />
          ) : null}

          {activeUtilityPanel === "registry" ? (
            <SpecPMRegistryPanel state={specpmRegistryState} />
          ) : null}
        </aside>
      ) : null}

      {selectedSpec ? (
        <SpecInspector
          className={styles.inspectorRail}
          selection={selectedSpec}
          specNodeDetailUrl={workspaceApiUrls.specNodes}
          specMarkdownUrl={workspaceApiUrls.specMarkdown}
          specMarkdownCompileUrl={workspaceApiUrls.specMarkdownCompile}
          onClose={clearSpecSelection}
          resolveSpecRef={resolveSpecRef}
          onSelectNodeId={selectSpecNodeId}
          compileCapability={hyperpromptCompileCapability}
          onAddMarkdownToAgentContext={addSpecMarkdownToAgentContext}
          onStartConversationFromMarkdown={startConversationFromSpecMarkdown}
        />
      ) : selectedGraphEdge ? (
        <SpecEdgeInspector
          className={styles.inspectorRail}
          edge={selectedGraphEdge}
          nodesById={nodesById}
          onClose={clearSpecSelection}
          resolveSpecRef={resolveSpecRef}
          onSelectNodeId={selectSpecNodeId}
          onAddEdgeToAgentContext={addSelectedEdgeToAgentContext}
        />
      ) : null}

      <ViewerChrome
        controls={{
          sidebarOpen,
          onSidebarToggle: () => setSidebarOpen((v) => !v),
          selectionHistory: specSelectionHistoryControls,
        }}
        status={{
          deployment: deploymentStatus,
          runsWatchVersion,
          recentKind: feedState.kind,
          eventCount: count,
          workKind: workState.kind,
          workItemCount: liveWorkItems.length,
          traceKind: proposalTraceState.kind,
          tooltip: liveStatusTooltip,
        }}
      />
    </div>
  );
}

function edgeContextSource(
  edge: SpecEdge,
  nodesById: ReadonlyMap<string, { title: string }>,
) {
  return {
    ...edge,
    source_title: nodesById.get(edge.source_id)?.title ?? null,
    target_title: nodesById.get(edge.target_id)?.title ?? null,
  };
}

function selectedSpecGapCount(
  node: {
    evidence_gap: number;
    input_gap: number;
    execution_gap: number;
  },
  gapKind: AgentContextSpecGapKind,
) {
  if (gapKind === "evidence") return node.evidence_gap;
  if (gapKind === "input") return node.input_gap;
  return node.execution_gap;
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "select" || tagName === "textarea";
}

function stringSetsEqual(
  left: ReadonlySet<string> | null,
  right: ReadonlySet<string>,
) {
  if (!left || left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function SidebarLogo() {
  return (
    <span className={styles.sidebarGlyph} aria-hidden="true">
      <svg
        width="1091"
        height="1091"
        viewBox="0 0 1091 1091"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M374 534.5C374 488.384 336.616 451 290.5 451C244.384 451 207 488.384 207 534.5C207 580.616 244.384 618 290.5 618V642C231.129 642 183 593.871 183 534.5C183 475.129 231.129 427 290.5 427C349.871 427 398 475.129 398 534.5C398 593.871 349.871 642 290.5 642V618C336.616 618 374 580.616 374 534.5Z"
          fill="currentColor"
        />
        <path
          d="M881 291.5C881 245.384 843.616 208 797.5 208C751.384 208 714 245.384 714 291.5C714 337.616 751.384 375 797.5 375V399C738.129 399 690 350.871 690 291.5C690 232.129 738.129 184 797.5 184C856.871 184 905 232.129 905 291.5C905 350.871 856.871 399 797.5 399V375C843.616 375 881 337.616 881 291.5Z"
          fill="currentColor"
        />
        <path
          d="M881 777.5C881 731.384 843.616 694 797.5 694C751.384 694 714 731.384 714 777.5C714 823.616 751.384 861 797.5 861V885C738.129 885 690 836.871 690 777.5C690 718.129 738.129 670 797.5 670C856.871 670 905 718.129 905 777.5C905 836.871 856.871 885 797.5 885V861C843.616 861 881 823.616 881 777.5Z"
          fill="currentColor"
        />
        <path
          d="M606.6 785.6C556.2 785.6 531 758.4 531 704V618.8C531 590.4 527.6 570.6 520.8 559.4C514.4 547.8 504.2 542 490.2 542C485.4 542 483 539.6 483 534.8C483 530 485.4 527.6 490.2 527.6C504.2 527.6 514.4 521.8 520.8 510.2C527.6 498.6 531 478.8 531 450.8V365.6C531 311.2 556.2 284 606.6 284C611.4 284 613.8 286.4 613.8 291.2C613.8 296 611.4 298.4 606.6 298.4C579.4 298.4 565.8 320 565.8 363.2V448.4C565.8 475.2 562.2 494.8 555 507.2C548.2 519.6 537 528.8 521.4 534.8C537 540.8 548.2 550 555 562.4C562.2 574.8 565.8 594.4 565.8 621.2V706.4C565.8 749.6 579.4 771.2 606.6 771.2C611.4 771.2 613.8 773.6 613.8 778.4C613.8 783.2 611.4 785.6 606.6 785.6Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
