import './ui/upstream.scoped.css';
// Read-only upstream declaration library; imports outside this slice use this API.
export { GraphCanvas, Inspector, FilterPanel, buildGraph, parseProjection,
  defaultFilters, graphVisibility, graphPackages } from './lib/upstream';
export { graphFilterCounts } from './lib/upstream/filters';
export type { Projection, Selection, GraphFilters } from './lib/upstream';
