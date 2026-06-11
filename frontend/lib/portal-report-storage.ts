export type ReportFilterValues = {
  flight_number: string;
  departure_date: string;
  departure_time: string;
  destination: string;
};

export type PersistedPortalReportState<TRow> = {
  filters: ReportFilterValues;
  appliedFilters: ReportFilterValues;
  rows: TRow[];
  searched: boolean;
  inlineFilter: string;
  page: number;
  pageSize: number;
};

export const PORTAL_REPORT_STORAGE_KEYS = {
  manifest: "portal:report:manifest",
  noShow: "portal:report:no-show",
} as const;

export function isPortalReportsPath(pathname: string) {
  return pathname === "/portal/reports" || pathname.startsWith("/portal/reports/");
}

export function savePortalReportState<TRow>(
  storageKey: string,
  state: PersistedPortalReportState<TRow>,
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey, JSON.stringify(state));
}

export function loadPortalReportState<TRow>(
  storageKey: string,
): PersistedPortalReportState<TRow> | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedPortalReportState<TRow>;
  } catch {
    return null;
  }
}

export function clearPortalReportState(storageKey: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey);
}

export function clearAllPortalReportStates() {
  Object.values(PORTAL_REPORT_STORAGE_KEYS).forEach(clearPortalReportState);
}
