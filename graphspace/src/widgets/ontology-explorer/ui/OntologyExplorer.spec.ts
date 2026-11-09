import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ontologyDiagram from "@/entities/ontology-diagram";
import { OntologyExplorer } from "./OntologyExplorer";

const fixture: unknown = JSON.parse(
  // The URL is a fixed repository fixture, not user-supplied input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFileSync(new URL("../model/motivation-full.fixture.json", import.meta.url), "utf8"),
);

describe("ontology graph preparation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("reuses a validated graph instead of building its layout again", () => {
    const projection = ontologyDiagram.parseProjection(fixture);
    const preparedGraph = ontologyDiagram.buildGraph(projection);
    const build = vi.spyOn(ontologyDiagram, "buildGraph");
    const html = renderToStaticMarkup(
      createElement(OntologyExplorer, { projection, preparedGraph }),
    );
    expect(html).toContain("Search graph");
    expect(build).not.toHaveBeenCalled();
  });

  it("still builds a graph for standalone fixtures", () => {
    const projection = ontologyDiagram.parseProjection(fixture);
    const build = vi.spyOn(ontologyDiagram, "buildGraph");
    renderToStaticMarkup(createElement(OntologyExplorer, { projection }));
    expect(build).toHaveBeenCalledTimes(1);
  });
});
