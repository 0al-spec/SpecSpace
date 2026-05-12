import type { z } from "zod";
import {
  specGraphResponseSchema,
  type SpecGraph,
  type SpecGraphResponse,
  type SpecGraphSummary,
} from "../schemas/spec-graph";
import type { ParseResult } from "./parse";

type Invariant<T> = (data: T) => string | null;

const countsMatch = (
  label: string,
  expected: number,
  actual: number,
): string | null => {
  if (expected === actual) return null;
  return `${label} mismatch: summary=${expected}, actual=${actual}`;
};

const graphSummaryCounts: Invariant<SpecGraphResponse> = ({ graph }) => {
  const checks = [
    countsMatch("node_count", graph.summary.node_count, graph.nodes.length),
    countsMatch("edge_count", graph.summary.edge_count, graph.edges.length),
    countsMatch("root_count", graph.summary.root_count, graph.roots.length),
    countsMatch(
      "blocked_file_count",
      graph.summary.blocked_file_count,
      graph.blocked_files.length,
    ),
    countsMatch(
      "diagnostic_count",
      graph.summary.diagnostic_count,
      graph.diagnostics.length,
    ),
    countsMatch(
      "broken_edge_count",
      graph.summary.broken_edge_count,
      graph.edges.filter((edge) => edge.status === "broken").length,
    ),
  ].filter((message): message is string => message !== null);

  return checks[0] ?? null;
};

const sameSummary = (a: SpecGraphSummary, b: SpecGraphSummary): boolean =>
  a.node_count === b.node_count &&
  a.edge_count === b.edge_count &&
  a.root_count === b.root_count &&
  a.blocked_file_count === b.blocked_file_count &&
  a.diagnostic_count === b.diagnostic_count &&
  a.broken_edge_count === b.broken_edge_count;

const responseSummaryMirrorsGraph: Invariant<SpecGraphResponse> = (data) => {
  if (sameSummary(data.summary, data.graph.summary)) return null;
  return "top-level summary does not match graph.summary";
};

const rootIdsResolve: Invariant<SpecGraphResponse> = ({ graph }) => {
  const nodeIds = new Set(graph.nodes.map((node) => node.node_id));
  const missingRoot = graph.roots.find((rootId) => !nodeIds.has(rootId));
  return missingRoot ? `root id '${missingRoot}' does not resolve to a node` : null;
};

const edgeEndpointsAreConsistent: Invariant<SpecGraphResponse> = ({ graph }) => {
  const nodeIds = new Set(graph.nodes.map((node) => node.node_id));

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source_id)) {
      return `edge '${edge.edge_id}' source '${edge.source_id}' does not resolve to a node`;
    }

    if (edge.status === "resolved" && !nodeIds.has(edge.target_id)) {
      return `resolved edge '${edge.edge_id}' target '${edge.target_id}' does not resolve to a node`;
    }
  }

  return null;
};

const nodeGapTotals: Invariant<SpecGraphResponse> = ({ graph }) => {
  for (const node of graph.nodes) {
    const expected = node.evidence_gap + node.input_gap + node.execution_gap;
    if (node.gap_count !== expected) {
      return `node '${node.node_id}' gap_count mismatch: gap_count=${node.gap_count}, components=${expected}`;
    }
  }
  return null;
};

const invariants: Invariant<SpecGraphResponse>[] = [
  graphSummaryCounts,
  responseSummaryMirrorsGraph,
  rootIdsResolve,
  edgeEndpointsAreConsistent,
  nodeGapTotals,
];

const parseIssues = (error: z.ZodError): z.ZodIssue[] => error.issues;

export const parseSpecGraph = (raw: unknown): ParseResult<SpecGraphResponse> => {
  const result = specGraphResponseSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: parseIssues(result.error), raw };
  }

  for (const invariant of invariants) {
    const message = invariant(result.data);
    if (message !== null) {
      return { kind: "invariant-violation", message, raw };
    }
  }

  return { kind: "ok", data: result.data };
};

export type { SpecGraph, SpecGraphResponse };
