import { useCallback, useState } from "react";

export type SpecSearchApi = {
  query: string;
  setQuery: (query: string) => void;
  clear: () => void;
  hasQuery: boolean;
};

export function useSpecSearch(): SpecSearchApi {
  const [query, setQueryState] = useState("");

  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery);
  }, []);

  const clear = useCallback(() => setQueryState(""), []);

  return { query, setQuery, clear, hasQuery: query.trim().length > 0 };
}
