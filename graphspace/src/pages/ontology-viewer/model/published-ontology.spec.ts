import { describe, expect, it, vi } from 'vitest';
import { loadPublishedOntology, publishedWorkspace } from './published-ontology';
import { readFileSync } from 'node:fs';
const graph = JSON.parse(readFileSync(new URL('../../../widgets/ontology-explorer/model/motivation-full.fixture.json', import.meta.url), 'utf8'));
const row = (path = 'runs/product-one/ontology.graph.json') => ({ path, sha256: 'a'.repeat(64) });
const envelope = (kind: string, rest: object) => ({ api_version: 'v1', schema_version: 1, artifact_kind: kind, read_only: true, source: { workspace_id: 'product-one' }, ...rest });
function fetcher(rows: object[], content: object = {}) {
  return vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/content?') ?
    envelope('specspace_artifact_content', { path: row().path, content_kind: 'json', sha256: 'a'.repeat(64), data: graph, ...content }) :
    envelope('specspace_artifact_catalog', { artifacts: rows })), { status: 200 }));
}
const load = (fn: ReturnType<typeof fetcher>, path?: string) => loadPublishedOntology('product-one', new AbortController().signal, path, fn as typeof fetch);
describe('published ontology selection', () => {
  it('keeps workspace scope and uses only same-origin content API', async () => {
    const fn = fetcher([{ ...row(), url: 'https://untrusted.invalid/' }]);
    const result = await load(fn); expect(result.kind).toBe('loaded');
    expect(fn.mock.calls.every(([url]) => url.startsWith('/api/v1/artifacts') && url.includes('workspace=product-one'))).toBe(true);
  });
  it('selects diagrams before legacy IR, but does not fall back on invalid diagrams', async () => {
    const rows = [row(), { path: 'ontology.normalized.json', group: 'ontology_ir' }];
    expect((await load(fetcher(rows))).kind).toBe('loaded');
    await expect(load(fetcher(rows, { data: { ...graph, schemaVersion: 'ontology.diagram-projection/v999' } }))).rejects.toThrow('Unsupported');
  });
  it('loads existing published normalized IR without pretending it is a diagram', async () => {
    const ir = JSON.parse(readFileSync(new URL('./ontology-graph-contract/fixtures/ontology_normalized_ir.specgraph-core.min.json', import.meta.url), 'utf8'));
    const path = 'ontology.normalized.json';
    const fn = fetcher([{ path, group: 'ontology_ir' }], { path, data: ir });
    const result = await load(fn);
    expect(result.kind === 'loaded' && result.candidate.format).toBe('legacy');
  });
  it('requires an explicit choice between competing projections', async () => {
    const fn = fetcher([row(), row('runs/other/ontology.graph.json')]);
    expect((await load(fn)).kind).toBe('choose'); expect(fn).toHaveBeenCalledTimes(1);
    expect((await load(fn, row().path)).kind).toBe('loaded');
    await expect(load(fn, 'not-published.json')).rejects.toThrow('no longer published');
  });
  it('reports absence and rejects traversal or duplicate entries', async () => {
    expect(await load(fetcher([]))).toEqual({ kind: 'missing' });
    await expect(load(fetcher([row('../ontology.graph.json')]))).rejects.toThrow('Unsafe');
    await expect(load(fetcher([row(), row()]))).rejects.toThrow('Duplicate');
  });
  it('rejects changed content, a wrong path or foreign workspace source', async () => {
    await expect(load(fetcher([row()], { sha256: 'b'.repeat(64) }))).rejects.toThrow('changed since');
    await expect(load(fetcher([row()], { path: 'other.json' }))).rejects.toThrow('Unexpected');
    await expect(load(fetcher([row()], { source: { workspace_id: 'other' } }))).rejects.toThrow('another workspace');
  });
  it('distinguishes local catalogs without digests from manifest-bound data', async () => {
    const result = await load(fetcher([{ path: row().path }]));
    expect(result.kind === 'loaded' && result.digestMatched).toBe(false);
  });
  it('does not silently default invalid workspace input', () => {
    expect(publishedWorkspace('')).toBe('specgraph-bootstrap');
    expect(publishedWorkspace('?workspace=product-one')).toBe('product-one');
    expect(() => publishedWorkspace('?workspace=')).toThrow();
    expect(() => publishedWorkspace('?workspace=one&workspace=two')).toThrow();
  });
});
