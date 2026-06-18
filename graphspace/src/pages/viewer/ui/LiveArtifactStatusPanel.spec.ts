import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArtifactCatalog } from "../model/use-artifact-catalog";
import { LiveArtifactStatusPanel } from "./LiveArtifactStatusPanel";

const artifactCatalog: ArtifactCatalog = {
  apiVersion: "v1",
  artifactKind: "specspace_artifact_catalog",
  schemaVersion: 1,
  readOnly: true,
  source: {
    provider: "http",
  },
  summary: {
    artifactCount: 2,
    runsCount: 1,
    ontologyArtifactCount: 1,
    ontologyIrCount: 1,
    rootCounts: {
      runs: 1,
      tests: 1,
    },
    groupCounts: {
      ontology: 1,
      ontology_ir: 1,
    },
  },
  artifacts: [
    {
      path: "runs/ontology_package_index.json",
      root: "runs",
      label: "ontology package index",
      group: "ontology",
      sizeBytes: 520,
      sha256: "abc123",
      url: "https://specgraph.tech/runs/ontology_package_index.json",
      referencedByPackageIndex: false,
    },
    {
      path: "tests/fixtures/ontology_import/specgraph-core/ontology.normalized.json",
      root: "tests",
      label: "ontology normalized",
      group: "ontology_ir",
      sizeBytes: 2048,
      sha256: "def456",
      url: "https://specgraph.tech/tests/fixtures/ontology_import/specgraph-core/ontology.normalized.json",
      referencedByPackageIndex: true,
    },
  ],
  manifest: null,
};

describe("LiveArtifactStatusPanel", () => {
  it("renders the published artifact catalog and ontology IR entries", () => {
    const html = renderToStaticMarkup(
      createElement(LiveArtifactStatusPanel, {
        diagnostics: [],
        artifactCatalogState: { kind: "ok", data: artifactCatalog },
        runsWatchVersion: 7,
      }),
    );

    expect(html).toContain("Published artifact catalog");
    expect(html).toContain("2 files");
    expect(html).toContain("1 ontology");
    expect(html).toContain("ontology package index");
    expect(html).toContain("ontology.normalized.json");
  });
});
