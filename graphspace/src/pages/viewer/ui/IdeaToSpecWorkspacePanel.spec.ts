import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ideaToSpecWorkspace } from "../model/idea-to-spec-workspace.fixture";
import {
  parseIdeaToSpecWorkspace,
  type UseIdeaToSpecWorkspaceState,
} from "../model/use-idea-to-spec-workspace";
import { IdeaToSpecWorkspacePanel } from "./IdeaToSpecWorkspacePanel";

const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);
if (parsed.kind !== "ok") {
  throw new Error("Idea-to-spec fixture must parse");
}

const state: UseIdeaToSpecWorkspaceState = {
  kind: "ok",
  data: parsed.data,
};

describe("IdeaToSpecWorkspacePanel", () => {
  it("renders candidate graph, pre-SIB metrics, and repair actions read-only", () => {
    const html = renderToStaticMarkup(
      createElement(IdeaToSpecWorkspacePanel, { state }),
    );

    expect(html).toContain("Idea-to-Spec Workspace");
    expect(html).toContain("DemoCalculator");
    expect(html).toContain("Source artifacts");
    expect(html).toContain("runs/candidate_repair_loop_report.json");
    expect(html).toContain("Event-storming intake");
    expect(html).toContain("Candidate graph");
    expect(html).toContain("candidate-spec.numeric-input");
    expect(html).toContain("Pre-SIB coherence");
    expect(html).toContain("pre_sib_ontology_coverage_gap");
    expect(html).toContain("Repair loop");
    expect(html).toContain("repair.add-ac.req-input-digits");
    expect(html).toContain("requires_context");
    expect(html).toContain("Promotion preview");
    expect(html).toContain("materialized_candidate_review_ready");
    expect(html).toContain("CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT");
    expect(html).toContain("platform_graph_repository_promotion_request");
    expect(html).toContain("Spec mutations");
    expect(html).toContain("false");
    expect(html).not.toContain("<button");
  });
});
