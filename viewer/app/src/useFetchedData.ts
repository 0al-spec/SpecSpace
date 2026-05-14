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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const nextData = transform(await res.json());
      onData?.(nextData, dataRef.current);
      dataRef.current = nextData;
      setData(nextData);
    } catch (e) {
      setError(e instanceof Error ? e.message : failureMessage);
    } finally {
      setLoading(false);
    }
  }, [failureMessage, onData, transform, url]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
