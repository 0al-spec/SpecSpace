import { useEffect, useState } from 'react';
import { loadPublishedOntology, type PublishedResult } from './published-ontology';
export type PublishedState = PublishedResult | { kind: 'local' | 'loading' } | { kind: 'error'; message: string };
export function usePublishedOntology(workspace: string | null, enabled: boolean, path: string | undefined, refresh: number): PublishedState {
  const requestKey = JSON.stringify([workspace, path, refresh]);
  const [stored, setStored] = useState<{ key: string; value: PublishedState }>({ key: '', value: { kind: 'loading' } });
  useEffect(() => {
    if (!enabled || !workspace) return;
    const setState = (value: PublishedState) => setStored({ key: requestKey, value });
    const controller = new AbortController(); let cancelled = false;
    setState({ kind: 'loading' });
    loadPublishedOntology(workspace, controller.signal, path).then(result => { if (!cancelled) setState(result); })
      .catch(error => { if (!cancelled) setState({ kind: 'error', message: error instanceof Error ? error.message : 'Published ontology could not be loaded' }); });
    return () => { cancelled = true; controller.abort(); };
  }, [workspace, enabled, path, refresh, requestKey]);
  return !enabled ? { kind: 'local' } : stored.key === requestKey ? stored.value : { kind: 'loading' };
}
