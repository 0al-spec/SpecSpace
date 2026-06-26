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
    expect(html).toContain("Workflow lane");
    expect(html).toContain("repair required");
    expect(html).toContain("Resolve context-required repairs before promotion");
    expect(html).toContain("operator_only");
    expect(html).toContain("Idea intake draft");
    expect(html).toContain("No local idea draft");
    expect(html).toContain("local_browser_draft");
    expect(html).toContain("Active workspace");
    expect(html).toContain("Team Decision Log");
    expect(html).toContain("product_spec_workspace");
    expect(html).toContain("DemoCalculator");
    expect(html).toContain("Source artifacts");
    expect(html).toContain("runs/candidate_spec_graph_seed.json");
    expect(html).toContain("runs/candidate_repair_loop_report.json");
    expect(html).toContain("Event-storming intake");
    expect(html).toContain("Ontology-bound seed");
    expect(html).toContain("ontology-gap.numeric-input");
    expect(html).toContain("confirm_bind_or_promote_domain_term");
    expect(html).toContain("Candidate graph");
    expect(html).toContain("candidate-spec.numeric-input");
    expect(html).toContain("Pre-SIB coherence");
    expect(html).toContain("pre_sib_ontology_coverage_gap");
    expect(html).toContain("Repair loop");
    expect(html).toContain("repair.add-ac.req-input-digits");
    expect(html).toContain("requires_context");
    expect(html).toContain("Repair session");
    expect(html).toContain("repair-session.team-decision-log");
    expect(html).toContain("repair_session_journal_ready");
    expect(html).toContain("candidate_quality_partially_improved");
    expect(html).toContain("candidate_not_ready_for_approval");
    expect(html).toContain("active_candidate_review_required");
    expect(html).toContain("propose_project_local_term");
    expect(html).toContain("Product repair review");
    expect(html).toContain("Ontology gap quality");
    expect(html).toContain("candidate_quality_improved");
    expect(html).toContain("product-ontology-decision.numeric-input.0");
    expect(html).toContain("rerun_overlay_only");
    expect(html).toContain("Promotion preview");
    expect(html).toContain("materialized_candidate_review_ready");
    expect(html).toContain("CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT");
    expect(html).toContain("platform_graph_repository_promotion_request");
    expect(html).toContain("Promotion gate");
    expect(html).toContain("idea_to_spec_promotion_blocked");
    expect(html).toContain("repair_context_required");
    expect(html).toContain("Controlled promotion");
    expect(html).toContain("Platform promotion request");
    expect(html).toContain("Candidate approval");
    expect(html).toContain("candidate_approval_ready");
    expect(html).toContain("operator://workspace-owner");
    expect(html).toContain("Git Service execution");
    expect(html).toContain("prepare worktree");
    expect(html).toContain("commit candidate");
    expect(html).toContain("open review");
    expect(html).toContain("Review status");
    expect(html).toContain("Read-model publication");
    expect(html).toContain("published-read-model/artifact_manifest.json");
    expect(html).toContain("review status");
    expect(html).toContain("Repair drafts loading");
    expect(html).toContain("Repair rerun request loading");
    expect(html).toContain("Save draft");
    expect(html).toContain("Spec mutations");
    expect(html).toContain("false");
    expect(html).not.toContain("Apply to SpecGraph");
    expect(html).not.toContain("Accept ontology term");
    expect(html).not.toContain("Create branch");
  });
});
