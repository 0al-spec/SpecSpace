import { useCallback, useEffect, useRef, useState } from "react";

interface UseFetchedDataOptions<T> {
  failureMessage: string;
  onData?: (data: T, previousData: T | null) => void;
}

export function useFetchedData<T>(
  url: string,
  transform: (json: unknown) => T,
  { failureMessage, onData }: UseFetchedDataOptions<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const nextData = transform(await res.json());
      if (requestIdRef.current !== requestId) return;
      onData?.(nextData, dataRef.current);
      dataRef.current = nextData;
      setData(nextData);
    } catch (e) {
      if (requestIdRef.current !== requestId || isAbortError(e)) return;
      setError(e instanceof Error ? e.message : failureMessage);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }, [failureMessage, onData, transform, url]);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
