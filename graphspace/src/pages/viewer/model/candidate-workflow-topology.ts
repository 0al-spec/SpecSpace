import type {
  IdeaToSpecCandidateOverview,
  IdeaToSpecOverviewEdge,
  IdeaToSpecOverviewItem,
} from "./use-idea-to-spec-workspace";

export type CandidateWorkflowTopologyColumnId =
  | "actors"
  | "commands"
  | "events"
  | "policies"
  | "constraints";

export type CandidateWorkflowTopologyNode = IdeaToSpecOverviewItem & {
  columnId: CandidateWorkflowTopologyColumnId;
};

export type CandidateWorkflowTopologyColumn = {
  id: CandidateWorkflowTopologyColumnId;
  label: string;
  nodes: readonly CandidateWorkflowTopologyNode[];
  totalCount: number;
};

export type CandidateWorkflowTopologyEdge = IdeaToSpecOverviewEdge & {
  relationLabel: string;
  fromNode: CandidateWorkflowTopologyNode | null;
  toNode: CandidateWorkflowTopologyNode | null;
  unresolvedRefs: readonly string[];
};

export type CandidateWorkflowTopologyView = {
  columns: readonly CandidateWorkflowTopologyColumn[];
  edges: readonly CandidateWorkflowTopologyEdge[];
  unresolvedEdges: readonly CandidateWorkflowTopologyEdge[];
  relationCounts: Record<string, number>;
  relationEntries: readonly [string, number][];
  edgeCount: number;
  workflowEdgeCount: number;
};

export const WORKFLOW_TOPOLOGY_RELATION_LABELS: Record<string, string> = {
  actor_triggers_command: "actor triggers command",
  command_emits_event: "command emits event",
  event_informs_policy: "event informs policy",
  event_informs_constraint: "event informs constraint",
  policy_applies_to_command: "policy applies to command",
  constraint_applies_to_command: "constraint applies to command",
};

const COLUMN_DEFINITIONS: readonly {
  id: CandidateWorkflowTopologyColumnId;
  label: string;
  items: (overview: IdeaToSpecCandidateOverview) => readonly IdeaToSpecOverviewItem[];
  totalCount: (overview: IdeaToSpecCandidateOverview) => number;
}[] = [
  {
    id: "actors",
    label: "Actors",
    items: (overview) => overview.eventStorming.actors,
    totalCount: (overview) => overview.eventStorming.actorCount,
  },
  {
    id: "commands",
    label: "Commands",
    items: (overview) => overview.eventStorming.commands,
    totalCount: (overview) => overview.eventStorming.commandCount,
  },
  {
    id: "events",
    label: "Events",
    items: (overview) => overview.eventStorming.domainEvents,
    totalCount: (overview) => overview.eventStorming.domainEventCount,
  },
  {
    id: "policies",
    label: "Policies",
    items: (overview) => overview.eventStorming.policies,
    totalCount: (overview) => overview.eventStorming.policyCount,
  },
  {
    id: "constraints",
    label: "Constraints",
    items: (overview) => overview.eventStorming.constraints,
    totalCount: (overview) => overview.eventStorming.constraintCount,
  },
];

function relationLabel(relation: string | null): string {
  if (!relation) return "relates";
  return WORKFLOW_TOPOLOGY_RELATION_LABELS[relation] ?? relation.replace(/_/g, " ");
}

function relationEntries(relationCounts: Record<string, number>): [string, number][] {
  return Object.entries(relationCounts).sort(([left], [right]) =>
    relationLabel(left).localeCompare(relationLabel(right)),
  );
}

export function buildCandidateWorkflowTopology(
  overview: IdeaToSpecCandidateOverview,
): CandidateWorkflowTopologyView {
  const nodeById = new Map<string, CandidateWorkflowTopologyNode>();
  const columns = COLUMN_DEFINITIONS.map((definition) => {
    const nodes = definition.items(overview).map((item) => ({
      ...item,
      columnId: definition.id,
    }));
    nodes.forEach((node) => nodeById.set(node.id, node));
    return {
      id: definition.id,
      label: definition.label,
      nodes,
      totalCount: definition.totalCount(overview),
    };
  });

  const edges = overview.topology.edges.map((edge) => {
    const fromNode = edge.from ? nodeById.get(edge.from) ?? null : null;
    const toNode = edge.to ? nodeById.get(edge.to) ?? null : null;
    const unresolvedRefs = [
      edge.from && !fromNode ? edge.from : null,
      edge.to && !toNode ? edge.to : null,
    ].filter((ref): ref is string => Boolean(ref));
    return {
      ...edge,
      relationLabel: relationLabel(edge.relation),
      fromNode,
      toNode,
      unresolvedRefs,
    };
  });

  return {
    columns,
    edges,
    unresolvedEdges: edges.filter((edge) => edge.unresolvedRefs.length > 0),
    relationCounts: overview.topology.relationCounts,
    relationEntries: relationEntries(overview.topology.relationCounts),
    edgeCount: overview.topology.edgeCount,
    workflowEdgeCount: overview.topology.workflowEdgeCount,
  };
}
