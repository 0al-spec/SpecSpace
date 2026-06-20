import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  parseOntologyWorkbench,
  type UseOntologyWorkbenchState,
} from "../model/use-ontology-workbench";
import { workbench } from "../model/ontology-workbench.fixture";
import { OntologyWorkbenchPanel } from "./OntologyWorkbenchPanel";

const parsed = parseOntologyWorkbench(workbench);
if (parsed.kind !== "ok") {
  throw new Error("Workbench fixture must parse");
}

const state: UseOntologyWorkbenchState = {
  kind: "ok",
  data: parsed.data,
};

describe("OntologyWorkbenchPanel", () => {
  it("renders consolidated ontology artifacts without mutation actions", () => {
    const html = renderToStaticMarkup(
      createElement(OntologyWorkbenchPanel, { state }),
    );

    expect(html).toContain("Ontology Workbench");
    expect(html).toContain("org.0al.specgraph.core@0.1.0");
    expect(html).toContain("Ontology layers");
    expect(html).toContain("objective");
    expect(html).toContain("meta");
    expect(html).toContain("Unassigned gaps");
    expect(html).toContain("SpecGraph");
    expect(html).toContain("definesRequirement");
    expect(html).toContain("sgcore:Spec");
    expect(html).toContain("sgcore:Requirement");
    expect(html).toContain("ontology-gap-review-legacy-term-intent");
    expect(html).toContain("SG-SPEC-0001");
    expect(html).toContain("active_frame_incomplete");
    expect(html).toContain("accepted_term");
    expect(html).toContain("legacy-spec-ontology-backfill-batch-001");
    expect(html).toContain("Ontology writes");
    expect(html).toContain("false");
    expect(html).not.toContain("<button");
  });
});
