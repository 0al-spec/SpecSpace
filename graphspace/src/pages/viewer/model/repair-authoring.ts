import type { IdeaToSpecClarificationRequest, IdeaToSpecGuidedRepairPath, IdeaToSpecMaterializedFile } from "./use-idea-to-spec-workspace";

export function repairSpecificationForRequest(
  request: IdeaToSpecClarificationRequest,
  files: readonly IdeaToSpecMaterializedFile[],
) {
  const matches = files.filter((file) => file.candidateNodeId && (
    request.targetRef === file.candidateNodeId ||
    request.targetRef?.startsWith(`${file.candidateNodeId}.gaps.`)
  ));
  return matches.length === 1 ? matches[0] : null;
}

export function specificationAnchor(file: IdeaToSpecMaterializedFile) {
  return `idea-to-spec-file-${encodeURIComponent(file.materializedId)}`;
}

export function repairSourceSessionIsHistorical(path: IdeaToSpecGuidedRepairPath): boolean {
  return path.available && path.stage === "repaired_ready" &&
    path.state.rerunRequestStatus === "consumed" &&
    path.state.rerunExecutionStatus === "completed" &&
    path.state.rerunPublicationStatus === "published" &&
    path.blockers.length === 0 &&
    path.counts.unresolvedBlockingAnswerCount === 0 &&
    path.counts.unresolvedCandidateGapCount === 0 &&
    path.counts.unresolvedOntologyGapCount === 0;
}

export function repairQuestionPresentation(
  request: IdeaToSpecClarificationRequest,
  sourceSessionHistorical: boolean,
  draftSaved: boolean,
  draftStateLoaded: boolean,
) {
  const covered = request.status === "covered_by_repair_context";
  const closed = ["closed", "resolved", "superseded"].includes(request.status);
  return {
    historical: (sourceSessionHistorical && !request.targetRef?.startsWith("event_storming_hints.")) || covered || closed,
    label: sourceSessionHistorical && !request.targetRef?.startsWith("event_storming_hints.") ? "source session history"
      : covered ? "covered by repair context"
      : closed ? request.status
      : !draftStateLoaded ? "draft state unavailable"
      : draftSaved ? "saved, awaiting validation" : "answer needed",
  };
}
