"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

type ListFetcher<T> = (search: string) => Promise<T[]>;

/** Live search: debounced API fetch; clearing the field reloads the full list immediately. */
export function useLiveListQuery<T>(fetcher: ListFetcher<T>, debounceMs = 300) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetcherRef.current(query);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(debouncedSearch);
  }, [debouncedSearch, refresh]);

  return {
    search,
    setSearch,
    rows,
    setRows,
    loading,
    error,
    refresh: () => refresh(debouncedSearch),
  };
}
