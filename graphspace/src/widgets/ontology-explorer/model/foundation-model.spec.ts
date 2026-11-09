import { describe, expect, it } from "vitest";
import {
  buildGraph,
  defaultFilters,
  graphPackages,
  graphVisibility,
  parseProjection,
} from "@/entities/ontology-diagram";
import fixture from "./foundation-model.fixture.json";
import { typeLayerLayout } from "./type-layer-layout";

describe("foundation model integration", () => {
  it("resolves exact catalog definitions and keeps old projections unresolved", () => {
    const projection = parseProjection(fixture);
    const graph = buildGraph(projection);
    const entity = graph.nodes.find((node) => node.id === "classes/sg:DomainEntity");
    expect(entity?.data).toMatchObject({
      kind: "imported",
      origin: "specgraph.foundation@0.1.0",
      foundation: {
        id: "specgraph.foundation",
        catalogId: "ontology.foundation",
        version: "0.1.0",
        pointer: "/classes/DomainEntity",
      },
    });
    expect(
      graphPackages(graph, projection).find((item) => item.key === "specgraph.foundation@0.1.0")
        ?.loaded,
    ).toBe(true);
    const previous = buildGraph(parseProjection({ ...fixture, foundationCatalogs: undefined }));
    expect(
      previous.nodes.find((node) => node.id === "external/classes/sg:DomainEntity")?.data.kind,
    ).toBe("external");
    expect(graph.nodes).toHaveLength(previous.nodes.length);
    expect(graph.edges).toHaveLength(previous.edges.length);
    const layout = typeLayerLayout(graph);
    expect(layout.nodes.find((node) => node.id === entity?.id)).toBeDefined();
    const filters = defaultFilters();
    filters.origins.imported = false;
    expect(
      graphVisibility(layout, filters, projection.id).nodeIds.has("classes/sg:DomainEntity"),
    ).toBe(false);
  });
});
