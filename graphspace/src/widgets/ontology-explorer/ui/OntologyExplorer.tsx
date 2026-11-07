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
export function OntologyExplorer({ projection }: Readonly<{ projection: Projection }>) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"LR" | "RL" | "directed" | "relations">("LR");
  const [filters, setFilters] = useState(defaultFilters);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusNode, setFocusNode] = useState<{ id: string } | null>(null);
  const searchId = useId();
  const graph = useMemo(() => {
    const original = buildGraph(projection);
    if (direction === "RL") return mirrorGraph(original);
    if (direction === "directed") return directedLayout(original);
    if (direction === "relations") return directedLayout(original, "relations");
    return original;
  }, [projection, direction]);
  const classNodes = useMemo(
    () =>
      new Map(
        graph.nodes
          .filter((node) => node.id.startsWith("classes/"))
          .map((node) => [node.data.label, node]),
      ),
    [graph],
  );
  const counts = useMemo(() => graphFilterCounts(graph, projection.id), [graph, projection.id]);
  const packages = useMemo(() => graphPackages(graph, projection), [graph, projection]);
  const visibility = useMemo(
    () => graphVisibility(graph, filters, projection.id),
    [graph, filters, projection.id],
  );
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    const nodes = graph.nodes
      .filter(
        (node) =>
          (!search || visibility.nodeIds.has(node.id)) &&
          node.data.label.toLowerCase().includes(search),
      )
      .map((node) => ({
        key: node.id,
        label: node.data.label,
        kind: node.data.isAction ? "action" : node.data.kind,
        hidden: !visibility.nodeIds.has(node.id),
        focus: node.id,
        selection: { type: "node", id: node.id, data: node.data } as Selection,
      }));
    const seen = new Set<string>();
    const edges = [...graph.edges]
      .sort((a, b) => Number(visibility.edgeIds.has(b.id)) - Number(visibility.edgeIds.has(a.id)))
      .filter((edge) => {
        const data = edge.data;
        if (
          !data ||
          !edge.id.startsWith("relation/") ||
          (search && !visibility.edgeIds.has(edge.id)) ||
          data.kind !== "relation" ||
          !data.semanticId.toLowerCase().includes(search) ||
          seen.has(data.semanticId)
        )
          return false;
        seen.add(data.semanticId);
        return true;
      })
      .map((edge) => ({
        key: edge.id,
        label: edge.data!.semanticId,
        kind: "relation",
        focus: edge.source,
        hidden: !visibility.edgeIds.has(edge.id),
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
            onChange={(event) =>
              setDirection(event.target.value as "LR" | "RL" | "directed" | "relations")
            }
          >
            <option value="LR">References right</option>
            <option value="RL">References left (mirrored)</option>
            <option value="directed">Directed layers</option>
            <option value="relations">Relationship layers</option>
          </select>
          <small className="filter-search-note">
            {direction === "relations"
              ? "Relationship layers follow ontology relations; cycles may produce backward links."
              : "Hierarchy layers place base types before derived types and action roles before their relationships."}
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
          <div
            className="search-results declaration-catalog"
            aria-label={query.trim() ? "Search results" : "Declaration catalog"}
          >
            <span className="section-label">
              {query.trim()
                ? `${matches.length} MATCHES`
                : `DECLARATIONS · ${matches.filter((item) => item.kind !== "external").length}`}
            </span>
            {(
              [
                ["action", "Actions"],
                ["class", "Classes"],
                ["imported", "Imported classes"],
                ["relation", "Relationships"],
                ["protocol", "Protocols"],
                ["policy", "Policies"],
                ["machine", "State machines"],
                ["state", "States"],
                ["external", "Unloaded references"],
              ] as const
            ).map(([kind, title]) => {
              const items = matches.filter((match) => match.kind === kind);
              if (!items.length) return null;
              return (
                <details
                  key={kind}
                  open={Boolean(query.trim()) || ["action", "class", "relation"].includes(kind)}
                >
                  <summary>
                    {title} <span>{items.length}</span>
                  </summary>
                  {items.map((match) => (
                    <button
                      key={match.key}
                      onClick={() => {
                        setSelection(match.selection);
                        if (!match.hidden) setFocusNode({ id: match.focus });
                      }}
                    >
                      <span>{match.label}</span>
                      <small>
                        {match.kind}
                        {match.hidden ? " · hidden by filters" : ""}
                      </small>
                    </button>
                  ))}
                </details>
              );
            })}
          </div>
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
        <Inspector
          selection={selection}
          filtered={filtered}
          classReferences={classNodes}
          onSelectClass={(fqid) => {
            const node = classNodes.get(fqid);
            if (!node) return;
            setSelection({ type: "node", id: node.id, data: node.data });
            if (visibility.nodeIds.has(node.id)) setFocusNode({ id: node.id });
          }}
        />
      </div>
    </div>
  );
}
