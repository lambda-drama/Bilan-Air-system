"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PORTAL_LIST_PAGE_SIZE } from "@/lib/portal-list-pagination";
import type { PaginatedResponse } from "@/types/bilan";
import { useDebouncedValue } from "./use-debounced-value";

type PaginatedListFetcher<T> = (
  search: string,
  limit: number,
  offset: number,
) => Promise<PaginatedResponse<T>>;

type UsePaginatedListQueryOptions = {
  debounceMs?: number;
  /** When this value changes, the list refetches from page 1. */
  reloadKey?: string | number;
  initialPageSize?: number;
};

/** Debounced search + server-side limit/offset pagination. */
export function usePaginatedListQuery<T>(
  fetcher: PaginatedListFetcher<T>,
  options: UsePaginatedListQueryOptions = {},
) {
  const debounceMs = options.debounceMs ?? 300;
  const reloadKey = options.reloadKey ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    options.initialPageSize ?? DEFAULT_PORTAL_LIST_PAGE_SIZE,
  );
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, reloadKey, pageSize]);

  const runFetch = useCallback(async (query: string, currentPage: number, limit: number) => {
    setLoading(true);
    setError("");
    try {
      const offset = (currentPage - 1) * limit;
      const res = await fetcherRef.current(query, limit, offset);
      setRows(res.data);
      setTotal(res.total ?? res.data.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runFetch(debouncedSearch, page, pageSize);
  }, [debouncedSearch, page, pageSize, reloadKey, runFetch]);

  const refresh = useCallback(() => {
    return runFetch(debouncedSearch, page, pageSize);
  }, [debouncedSearch, page, pageSize, runFetch]);

  return {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    rows,
    total,
    loading,
    error,
    refresh,
  };
}
