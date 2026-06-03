"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

type ListFetcher<T> = (search: string) => Promise<T[]>;

type UseLiveListQueryOptions = {
  debounceMs?: number;
  /** When this value changes, the list refetches (e.g. status filter). */
  reloadKey?: string | number;
};

/** Live search: debounced API fetch; clearing the field reloads the full list immediately. */
export function useLiveListQuery<T>(
  fetcher: ListFetcher<T>,
  options: UseLiveListQueryOptions = {},
) {
  const debounceMs = options.debounceMs ?? 300;
  const reloadKey = options.reloadKey ?? "";
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const runFetch = useCallback(async (query: string) => {
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
    runFetch(debouncedSearch);
  }, [debouncedSearch, reloadKey, runFetch]);

  const refresh = useCallback(() => {
    return runFetch(debouncedSearch);
  }, [debouncedSearch, runFetch]);

  return {
    search,
    setSearch,
    rows,
    setRows,
    loading,
    error,
    refresh,
  };
}
