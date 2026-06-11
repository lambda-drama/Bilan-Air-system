"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearPortalReportState,
  loadPortalReportState,
  savePortalReportState,
  type ReportFilterValues,
} from "@/lib/portal-report-storage";

export function usePersistedPortalReport<TRow>(
  storageKey: string,
  emptyFilters: ReportFilterValues,
) {
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<ReportFilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterValues>(emptyFilters);
  const [rows, setRows] = useState<TRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [inlineFilter, setInlineFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    const saved = loadPortalReportState<TRow>(storageKey);
    if (saved) {
      setFilters(saved.filters);
      setAppliedFilters(saved.appliedFilters);
      setRows(saved.rows);
      setSearched(saved.searched);
      setInlineFilter(saved.inlineFilter);
      setPage(saved.page);
      setPageSize(saved.pageSize);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    savePortalReportState(storageKey, {
      filters,
      appliedFilters,
      rows,
      searched,
      inlineFilter,
      page,
      pageSize,
    });
  }, [
    hydrated,
    storageKey,
    filters,
    appliedFilters,
    rows,
    searched,
    inlineFilter,
    page,
    pageSize,
  ]);

  const resetReportState = useCallback(() => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setRows([]);
    setSearched(false);
    setInlineFilter("");
    setPage(1);
    clearPortalReportState(storageKey);
  }, [emptyFilters, storageKey]);

  return {
    hydrated,
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    rows,
    setRows,
    searched,
    setSearched,
    inlineFilter,
    setInlineFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    resetReportState,
  };
}
