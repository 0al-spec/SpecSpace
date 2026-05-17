import { describe, expect, it } from "vitest";
import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";
import { filterMetricsEntries, sortedFilterOptions } from "./metrics-filters";

const entry = (overrides: Partial<MetricsIndexEntry>): MetricsIndexEntry => ({
  metric_key: "metric_score::sib",
  category: "metric_score",
  item_id: "sib",
  title: "Specification-Implementation Balance",
  status: "healthy",
  secondary_status: null,
  score: null,
  minimum_score: null,
  value: null,
  next_gap: null,
  source_kind: "graph_dashboard",
  reference_texts: [],
  summary: {},
  ...overrides,
});

describe("filterMetricsEntries", () => {
  const entries = [
    entry({
      item_id: "sib",
      category: "metric_score",
      status: "healthy",
      source_kind: "graph_dashboard",
      reference_texts: ["SG-SPEC-0001"],
    }),
    entry({
      metric_key: "source_promotion::sib",
      item_id: "source_promotion::sib",
      category: "source_promotion",
      status: "draft_visible_only",
      source_kind: "metrics_source_promotion",
      reference_texts: ["SG-SPEC-0002"],
    }),
  ];

  it("filters by category, status, source kind, and reference query", () => {
    expect(filterMetricsEntries(entries, {
      category: "metric_score",
      status: "healthy",
      sourceKind: "graph_dashboard",
      referenceQuery: "sgspec0001",
    }).map((item) => item.item_id)).toEqual(["sib"]);

    expect(filterMetricsEntries(entries, {
      category: "source_promotion",
      status: "",
      sourceKind: "",
      referenceQuery: "0002",
    }).map((item) => item.category)).toEqual(["source_promotion"]);
  });
});

describe("sortedFilterOptions", () => {
  it("sorts count map keys for stable select order", () => {
    expect(sortedFilterOptions({ beta: 1, alpha: 1 })).toEqual(["alpha", "beta"]);
  });
});
