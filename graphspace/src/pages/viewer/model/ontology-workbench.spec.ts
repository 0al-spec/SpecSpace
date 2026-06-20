import { describe, expect, it } from "vitest";
import { workbench } from "./ontology-workbench.fixture";
import { parseOntologyWorkbench } from "./use-ontology-workbench";

describe("parseOntologyWorkbench", () => {
  it("parses the consolidated read-only ontology workbench", () => {
    const result = parseOntologyWorkbench(workbench);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.summary.gapGroupCount).toBe(1);
    expect(result.data.package?.packageId).toBe("org.0al.specgraph.core");
    expect(result.data.normalizedIr.classes[0]?.id).toBe("SpecGraph");
    expect(result.data.gapReview.groups[0]?.proposedTerm).toBe("Intent");
    expect(result.data.writeGate.wouldRejectInHardGate).toBe(true);
    expect(result.data.ownerDecisions.reviews[0]?.afterSemanticStatus).toBe("accepted_term");
    expect(result.data.legacyBackfill.smallPrBatches[0]?.mutatesCanonicalSpecs).toBe(false);
  });

  it("rejects authority expansion", () => {
    const expanded = {
      ...workbench,
      authority_boundary: {
        ...workbench.authority_boundary,
        may_write_ontology_package: true,
      },
    };

    const result = parseOntologyWorkbench(expanded);

    expect(result.kind).toBe("parse-error");
    if (result.kind !== "parse-error") return;
    expect(result.reason).toContain("may_write_ontology_package");
  });
});
