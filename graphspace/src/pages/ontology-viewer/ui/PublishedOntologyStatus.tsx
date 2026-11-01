import type { PublishedState } from '../model/use-published-ontology';
export function PublishedOntologyStatus({ workspace, state, onChoose, onRetry }: {
  workspace: string; state: PublishedState; onChoose: (path: string) => void; onRetry: () => void;
}) {
  return <section aria-label="Published workspace ontology" style={{ padding: '12px 24px', overflowWrap: 'anywhere' }}>
    <strong>Workspace: {workspace}</strong>{' · '}
    {state.kind === 'local' && <span>Local file selected. </span>}
    {state.kind === 'loading' && <span role="status">Loading published ontology… </span>}
    {state.kind === 'missing' && <span>No ontology graph is published for this workspace. Open a local file or retry after publication. </span>}
    {state.kind === 'error' && <span role="alert">{state.message}. Local file loading is available. </span>}
    {state.kind === 'choose' && <label>Choose published ontology <select value="" onChange={event => onChoose(event.target.value)}><option value="" disabled>Select a package…</option>{state.candidates.map(item => <option key={item.path} value={item.path}>{item.path}</option>)}</select></label>}
    {state.kind === 'loaded' && <span>{state.candidate.format === 'diagram' ? 'Published diagram projection' : 'Published normalized IR (legacy view)'} · {state.candidate.path} · {state.digestMatched ? 'catalog digest matched' : 'no catalog digest supplied'}. </span>}
    <button type="button" onClick={onRetry}>Reload published ontology</button>
  </section>;
}
