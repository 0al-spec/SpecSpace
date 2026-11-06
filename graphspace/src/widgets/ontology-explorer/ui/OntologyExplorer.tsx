import { useId, useMemo, useState } from "react";
import {
  GraphCanvas,
  Inspector,
  FilterPanel,
  buildGraph,
  defaultFilters,
  graphVisibility,
  graphFilterCounts,
  graphPackages,
  type Projection,
  type Selection,
} from "@/entities/ontology-diagram";
import { mirrorGraph } from "../model/mirror-graph";
import { directedLayout, reversesEdge } from "../model/directed-layout";
import "./ontology-explorer.css";

/** Read-only composition. It has no filesystem, HTTP or workspace-editor client. */
export function OntologyExplorer({ projection }: { projection: Projection }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"LR" | "RL" | "directed">("LR");
  const [filters, setFilters] = useState(defaultFilters);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusNode, setFocusNode] = useState<{ id: string } | null>(null);
  const searchId = useId();
  const graph = useMemo(() => {
    const original = buildGraph(projection);
    if (direction === "RL") return mirrorGraph(original);
    if (direction === "directed") return directedLayout(original);
    return original;
  }, [projection, direction]);
  const counts = useMemo(() => graphFilterCounts(graph, projection.id), [graph, projection.id]);
  const packages = useMemo(() => graphPackages(graph, projection), [graph, projection]);
  const visibility = useMemo(
    () => graphVisibility(graph, filters, projection.id),
    [graph, filters, projection.id],
  );
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return [];
    const nodes = graph.nodes
      .filter(
        (node) => visibility.nodeIds.has(node.id) && node.data.label.toLowerCase().includes(search),
      )
      .map((node) => ({
        key: node.id,
        label: node.data.label,
        kind: node.data.kind,
        focus: node.id,
        selection: { type: "node", id: node.id, data: node.data } as Selection,
      }));
    const edges = graph.edges
      .filter(
        (edge) =>
          visibility.edgeIds.has(edge.id) && edge.data?.semanticId.toLowerCase().includes(search),
      )
      .map((edge) => ({
        key: edge.id,
        label: edge.data!.semanticId,
        kind: edge.data!.kind,
        focus: edge.source,
        selection: {
          type: "edge",
          id: edge.id,
          source: reversesEdge(direction, edge.data?.kind) ? edge.target : edge.source,
          target: reversesEdge(direction, edge.data?.kind) ? edge.source : edge.target,
          data: edge.data!,
        } as Selection,
      }));
    return [...nodes, ...edges];
  }, [query, graph, visibility, direction]);
  let filtered = false;
  if (selection) {
    const visibleIds = selection.type === "node" ? visibility.nodeIds : visibility.edgeIds;
    filtered = !visibleIds.has(selection.id);
  }
  return (
    <div className="ontology-explorer">
      <div className="workspace">
        <section className="sidebar" aria-label="Graph navigation">
          <div className="section-label">PACKAGE · READ ONLY</div>
          <h1>{projection.id}</h1>
          <p className="package-version">
            {projection.version} · {projection.view} view
          </p>
          <div className="sidebar-rule" />
          <label className="search-label" htmlFor={`${searchId}-direction`}>
            Graph direction
          </label>
          <select
            id={`${searchId}-direction`}
            className="search"
            value={direction}
            onChange={(event) => setDirection(event.target.value as "LR" | "RL" | "directed")}
          >
            <option value="LR">References right</option>
            <option value="RL">References left (mirrored)</option>
            <option value="directed">Directed layers</option>
          </select>
          <small className="filter-search-note">
            Hierarchy layers place base types before derived types; other links do not affect
            placement.
          </small>
          <label className="search-label" htmlFor={searchId}>
            Search graph
          </label>
          <input
            id={searchId}
            className="search"
            placeholder="Type a name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <small className="filter-search-note">Search includes enabled elements.</small>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(defaultFilters())}
            counts={counts}
            packages={packages}
            view={projection.view}
          />
          {query.trim() && (
            <div className="search-results" aria-label="Search results">
              <span className="section-label">{matches.length} matches</span>
              {matches.map((match) => (
                <button
                  key={match.key}
                  onClick={() => {
                    setSelection(match.selection);
                    setFocusNode({ id: match.focus });
                  }}
                >
                  <span>{match.label}</span>
                  <small>{match.kind}</small>
                </button>
              ))}
            </div>
          )}
          <p className="explorer-authority">
            Declaration view. A valid file does not establish approval, policy execution or source
            truth.
          </p>
          <div className="sidebar-footer">
            Enabled: {visibility.nodeIds.size} / {graph.nodes.length} nodes ·{" "}
            {visibility.edgeIds.size} / {graph.edges.length} visual links
          </div>
        </section>
        <GraphCanvas
          graph={graph}
          identity={`${projection.id}@${projection.version}:${direction}`}
          search={query}
          focusNode={focusNode}
          visibility={visibility}
          filterMode={filters.mode}
          onSelect={(value) =>
            setSelection(
              value.type === "edge" && reversesEdge(direction, value.data.kind)
                ? { ...value, source: value.target, target: value.source }
                : value,
            )
          }
        />
        <Inspector selection={selection} filtered={filtered} />
      </div>
    </div>
  );
}
