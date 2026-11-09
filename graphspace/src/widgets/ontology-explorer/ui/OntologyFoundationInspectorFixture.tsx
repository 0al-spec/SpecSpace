import { buildGraph, Inspector, parseProjection } from "@/entities/ontology-diagram";
import fixture from "../model/foundation-model.fixture.json";

/** Isolated, source-derived foundation provenance state for the UI catalog. */
export function OntologyFoundationInspectorFixture() {
  const graph = buildGraph(parseProjection(fixture));
  const node = graph.nodes.find((item) => item.id === "classes/sg:DomainEntity");
  if (!node) throw new Error("Foundation fixture has no sg:DomainEntity");
  const classes = new Map(
    graph.nodes
      .filter((item) => item.id.startsWith("classes/"))
      .map((item) => [item.data.label, item]),
  );
  return (
    <div className="ontology-explorer" style={{ maxWidth: 340 }}>
      <Inspector
        selection={{ type: "node", id: node.id, data: node.data }}
        classReferences={classes}
        onSelectClass={() => undefined}
      />
    </div>
  );
}
