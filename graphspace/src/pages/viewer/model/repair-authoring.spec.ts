import { describe, expect, it } from "vitest";
import { ideaToSpecWorkspace } from "./idea-to-spec-workspace.fixture";
import { parseIdeaToSpecWorkspace, type IdeaToSpecClarificationRequest, type IdeaToSpecMaterializedFile } from "./use-idea-to-spec-workspace";
import { repairQuestionPresentation, repairSourceSessionIsHistorical, repairSpecificationForRequest, specificationAnchor } from "./repair-authoring";

const parsed = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);
if (parsed.kind !== "ok") throw new Error("Invalid fixture");
const request: IdeaToSpecClarificationRequest = {
  id: "question.enforcement", kind: "candidate_gap", status: "open", severity: "blocking",
  targetRef: "candidate.numeric-input.gaps.enforcement", targetArtifact: "runs/demo/requests.json",
  question: "Define enforcement", suggestedActions: ["answer_question"],
};
const file: IdeaToSpecMaterializedFile = {
  candidateNodeId: "candidate.numeric-input", materializedId: "numeric-input", displayAlias: "Numeric input",
  path: "runs/demo/specs/numeric.yaml", promotionPath: "specs/numeric.yaml",
};
const complete = {
  ...parsed.data.guidedRepairPath, available: true, stage: "repaired_ready", blockers: [],
  state: { ...parsed.data.guidedRepairPath.state, rerunRequestStatus: "consumed", rerunExecutionStatus: "completed", rerunPublicationStatus: "published" },
  counts: { ...parsed.data.guidedRepairPath.counts, unresolvedBlockingAnswerCount: 0, unresolvedCandidateGapCount: 0, unresolvedOntologyGapCount: 0 },
};

describe("repair authoring evidence", () => {
  it("only groups the source session as history with complete current path evidence", () => {
    expect(repairSourceSessionIsHistorical(complete)).toBe(true);
    for (const patch of [{ available: false }, { stage: "repair_answers_needed" }, { blockers: ["stale"] }]) {
      expect(repairSourceSessionIsHistorical({ ...complete, ...patch })).toBe(false);
    }
    expect(repairSourceSessionIsHistorical({ ...complete, state: { ...complete.state, rerunPublicationStatus: "failed" } })).toBe(false);
    expect(repairSourceSessionIsHistorical({ ...complete, state: { ...complete.state, rerunRequestStatus: "usable" } })).toBe(false);
    expect(repairSourceSessionIsHistorical({ ...complete, counts: { ...complete.counts, unresolvedBlockingAnswerCount: 1 } })).toBe(false);
  });
  it("does not turn successful publication into per-answer application", () => {
    expect(repairQuestionPresentation(request, true, true, true)).toEqual({ historical: true, label: "source session history" });
    expect(repairQuestionPresentation(request, false, true, true)).toEqual({ historical: false, label: "saved, awaiting validation" });
  });
  it("keeps new depth questions active after repair and does not ask for covered aggregate answers", () => {
    expect(repairQuestionPresentation({ ...request, targetRef: "event_storming_hints.actors" }, true, false, true).historical).toBe(false);
    expect(repairQuestionPresentation({ ...request, status: "covered_by_repair_context" }, false, false, true)).toEqual({ historical: true, label: "covered by repair context" });
  });
  it("distinguishes unavailable draft state from no saved answer", () => {
    expect(repairQuestionPresentation(request, false, false, false).label).toBe("draft state unavailable");
    expect(repairQuestionPresentation(request, false, false, true).label).toBe("answer needed");
  });
  it("joins only exact or delimited unique candidate refs to materialized specs", () => {
    expect(repairSpecificationForRequest(request, [file])).toBe(file);
    expect(repairSpecificationForRequest({ ...request, targetRef: "candidate.numeric-input-other.gaps.enforcement" }, [file])).toBeNull();
    expect(repairSpecificationForRequest({ ...request, targetRef: null }, [file])).toBeNull();
    expect(repairSpecificationForRequest(request, [file, { ...file, path: "other.yaml" }])).toBeNull();
    expect(specificationAnchor(file)).toBe("idea-to-spec-file-numeric-input");
  });
});
