import { describe, expect, it } from "vitest";
import { buildIdeaToSpecIntakeDraft } from "./idea-to-spec-intake-draft";
import type { IdeaToSpecActiveFrame } from "./use-idea-to-spec-workspace";

const activeFrame: IdeaToSpecActiveFrame = {
  project: "Product Pilot",
  subsystem: null,
  agentLayer: null,
  targetArtifact: null,
  lifecyclePhase: null,
  ontologyRefs: ["ontology://specgraph-core"],
  ontologyLayerRefs: ["ontology-layer.mechanics"],
  modelApplicabilityRefs: ["model-applicability.product-mvp"],
  domainRefs: ["domain.product-design"],
  contextRefs: ["context.idea_to_spec"],
};

describe("buildIdeaToSpecIntakeDraft", () => {
  it("creates a local non-canonical event-storming draft from raw idea text", () => {
    const draft = buildIdeaToSpecIntakeDraft({
      idea: "Teams record decisions with owners and evidence. Reviewers approve supersession conflicts.",
      activeFrame,
    });

    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.artifactKind).toBe("idea_event_storming_intake_draft");
    expect(draft.sourceMode).toBe("local_browser_draft");
    expect(draft.canonicalMutationsAllowed).toBe(false);
    expect(draft.trackedArtifactsWritten).toBe(false);
    expect(draft.project).toBe("Product Pilot");
    expect(draft.actors).toContain("actor.team");
    expect(draft.actors).toContain("actor.owner");
    expect(draft.policies).toContain("policy.owner-review-before-promotion");
    expect(draft.policies).toContain("policy.conflict-and-supersession-tracked");
    expect(draft.contextCompletionQuestions).toContain(
      "question.context.primary-success-metric",
    );
  });

  it("asks for ontology context when the active frame has no ontology refs", () => {
    const draft = buildIdeaToSpecIntakeDraft({
      idea: "A small workflow for customer support escalation.",
      activeFrame: { ...activeFrame, ontologyRefs: [] },
    });

    expect(draft?.contextCompletionQuestions).toContain(
      "question.context.active-ontology-package",
    );
  });
});
