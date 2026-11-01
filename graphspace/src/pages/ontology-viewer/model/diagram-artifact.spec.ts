import { describe, expect, it } from 'vitest';
import { selectDiagramArtifact } from './diagram-artifact';
import { readFileSync } from 'node:fs';
import { loadLocalOntologyArtifact } from './local-ontology-artifact';
const real = JSON.parse(readFileSync(new URL('../../../widgets/ontology-explorer/model/motivation-full.fixture.json', import.meta.url), 'utf8'));
const file = (name: string, value: unknown) => ({ name, path: name, text: JSON.stringify(value) });

describe('diagram artifact compatibility boundary', () => {
  it('accepts a real compiler projection under an arbitrary JSON filename', () => {
    const selected = selectDiagramArtifact([file('my-model.json', real)]);
    expect(selected.kind).toBe('diagram');
    if (selected.kind === 'diagram') {
      expect(selected.projection.sources.length).toBe(2);
      expect(selected.projection.policies.length).toBeGreaterThan(0);
      expect(selected.projection.stateMachines.length).toBeGreaterThan(0);
    }
  });
  it('does not reclassify normalized IR or legacy metadata as a diagram', () => {
    const ir = JSON.parse(readFileSync(new URL('./ontology-graph-contract/fixtures/ontology_normalized_ir.specgraph-core.min.json', import.meta.url), 'utf8'));
    const files = [file('ontology.normalized.json', ir)];
    expect(selectDiagramArtifact(files)).toEqual({ kind: 'none' });
    expect(loadLocalOntologyArtifact(files).kind).toBe('loaded');
  });
  it('rejects future schema versions instead of falling back to normalized IR', () => {
    expect(() => selectDiagramArtifact([file('future.json', { ...real, schemaVersion: 'ontology.diagram-projection/v2' })])).toThrow('Unsupported schemaVersion');
  });
  it('rejects invalid JSON and malformed source provenance', () => {
    expect(() => selectDiagramArtifact([{ name: 'ontology.graph.json', path: 'ontology.graph.json', text: '{' }])).toThrow('Invalid diagram JSON');
    const bad = structuredClone(real); bad.classes[0].source.sourceByteDigest = 'sha256:' + '0'.repeat(64);
    expect(() => selectDiagramArtifact([file('bad.json', bad)])).toThrow('source does not match');
  });
  it('rejects ambiguous diagram/IR and multiple-diagram selections', () => {
    expect(() => selectDiagramArtifact([file('one.json', real), file('two.json', real)])).toThrow('Select one diagram');
    expect(() => selectDiagramArtifact([file('one.json', real), file('ontology.normalized.json', {})])).toThrow('not both');
  });
});
