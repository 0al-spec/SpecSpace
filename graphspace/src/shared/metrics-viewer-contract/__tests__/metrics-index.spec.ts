import { describe, expect, it } from "vitest";
import { parseMetricsIndex } from "../parsers/parse-metrics-index";

const metricsIndex = () => ({
  api_version: "v1",
  artifact_kind: "specspace_metrics_index",
  generated_at: "2026-05-17T12:30:00Z",
  read_only: true,
  source: { provider: "http", artifact_base_url: "https://specgraph.tech" },
  entry_count: 1,
  entries: [
    {
      metric_key: "metric_score::sib",
      category: "metric_score",
      item_id: "sib",
      title: "Specification-Implementation Balance",
      status: "healthy",
      secondary_status: null,
      score: 0.74,
      minimum_score: 0.6,
      value: null,
      next_gap: null,
      source_kind: "graph_dashboard",
      reference_texts: ["SG-SPEC-0001"],
      summary: { threshold_gap: -0.14 },
    },
  ],
  filters: {
    category_counts: { metric_score: 1 },
    status_counts: { healthy: 1 },
    source_kind_counts: { graph_dashboard: 1 },
    reference_texts: ["SG-SPEC-0001"],
  },
  dashboard: {
    available: true,
    metric_count: 1,
  },
  sources: {
    graph_dashboard: {
      available: true,
      artifact: "runs/graph_dashboard.json",
      entry_count: 1,
    },
  },
});

describe("parseMetricsIndex", () => {
  it("accepts the SpecSpace metrics index payload", () => {
    const result = parseMetricsIndex(metricsIndex());

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.entries[0].reference_texts).toEqual(["SG-SPEC-0001"]);
    expect(result.data.filters.category_counts.metric_score).toBe(1);
  });

  it("rejects non-metrics-index payloads", () => {
    const broken = metricsIndex();
    broken.artifact_kind = "graph_dashboard";

    expect(parseMetricsIndex(broken).kind).toBe("parse-error");
  });
});
