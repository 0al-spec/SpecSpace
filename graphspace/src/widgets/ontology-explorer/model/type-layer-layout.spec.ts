import { describe, expect, it } from "vitest";
import { buildGraph, parseProjection } from "@/entities/ontology-diagram";
import publication from "./publication-verification.fixture.json";
import { typeLayerLayout } from "./type-layer-layout";

describe("typeLayerLayout", () => {
  it("groups foundation bases, classes, actions and relationship nodes without changing declarations", () => {
    const input = buildGraph(parseProjection(publication));
    const graph = typeLayerLayout(input);
    const node = (id: string) => graph.nodes.find((item) => item.id === id)!;
    const x = (id: string) => node(id).position.x;
    const base = "external/classes/ont:DomainEntity";
    const actionBase = "external/classes/ont:Action";
    const verifier = "classes/pubverify:PublicationVerifier";
    const retained = "classes/pubverify:RetainedBundle";
    const action = "classes/pubverify:VerifyPublishedBundle";
    const relation = "relations/pubverify:verifiesPublishedBundle";
    expect(x(base)).toBe(x(actionBase));
    expect(x(base)).toBeLessThan(x(verifier));
    expect(x(verifier)).toBe(x(retained));
    expect(x(retained)).toBeLessThan(x(action));
    expect(x(action)).toBeLessThan(x(relation));
    expect(graph.edges).toHaveLength(input.edges.length);
    expect(
      graph.edges.find((edge) => edge.id === "extends/pubverify:PublicationVerifier"),
    ).toMatchObject({ source: base, target: verifier, label: "extended by" });
    expect(
      graph.edges.find(
        (edge) => edge.id === "field/pubverify:VerifyPublishedBundle/expectedBundle",
      ),
    ).toMatchObject({ source: retained, target: action, targetHandle: "field-expectedBundle" });
    expect(node(action).data.record).toEqual(
      input.nodes.find((item) => item.id === action)!.data.record,
    );
    expect(typeLayerLayout(input)).toEqual(graph);
    const groups = new Map<number, typeof graph.nodes>();
    for (const item of graph.nodes) {
      const column = groups.get(item.position.x) ?? [];
      column.push(item);
      groups.set(item.position.x, column);
    }
    for (const nodes of groups.values()) {
      nodes.sort((a, b) => a.position.y - b.position.y);
      let previousEnd = -Infinity;
      for (const item of nodes) {
        expect(item.position.y).toBeGreaterThanOrEqual(previousEnd);
        previousEnd = item.position.y + 76 + (item.data.ports?.length ?? 0) * 34;
      }
    }
  });

  it("keeps unresolved action references in the action lane", () => {
    const value = {
      ...publication,
      classes: publication.classes.filter((item) => item.id !== "VerifyPublishedBundle"),
    };
    const graph = typeLayerLayout(buildGraph(parseProjection(value)));
    const x = (id: string) => graph.nodes.find((item) => item.id === id)!.position.x;
    expect(x("classes/pubverify:PublishedBundle")).toBeLessThan(
      x("external/classes/pubverify:VerifyPublishedBundle"),
    );
    expect(x("external/classes/pubverify:VerifyPublishedBundle")).toBeLessThan(
      x("relations/pubverify:verifiesPublishedBundle"),
    );
  });
});
