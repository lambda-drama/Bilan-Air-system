"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, Mail, MessageSquare } from "lucide-react";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { usePersistedPortalReport } from "@/hooks/use-persisted-portal-report";
import { useReportFlightNumbers } from "@/hooks/use-report-flight-numbers";
import { PORTAL_REPORT_STORAGE_KEYS } from "@/lib/portal-report-storage";
import { StatusBadge } from "@/components/portal/status-badge";
import { AgentNameCell } from "@/components/portal/agent-name-cell";
import { getAgentFirstName } from "@/lib/agent-display";
import { fetchAirportsForPortal } from "@/services/airport";
import { buildAirportSelectOptions } from "@/lib/airport-select";
import {
  getManifestDepartureTimes,
  getManifestReport,
  type ManifestReportRow,
} from "@/services/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PortalReportPdfPreviewDialog } from "@/components/portal/portal-report-pdf-preview";
import {
  buildReportSubtitle,
  exportPortalReportExcel,
  fetchPortalReportPdf,
  type PortalReportPdfColumn,
  type PortalReportPdfFile,
} from "@/lib/portal-report-export";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const MANIFEST_PDF_COLUMNS: PortalReportPdfColumn[] = [
  { key: "pnr_number", label: "PNR number" },
  { key: "passenger_name", label: "Passenger name" },
  { key: "class", label: "Class" },
  { key: "agent", label: "Agent" },
  { key: "agency_company", label: "Agency" },
  { key: "passport_number", label: "Passport number" },
  { key: "origin", label: "Origin" },
  { key: "destination", label: "Destination" },
  { key: "phone", label: "Phone" },
  { key: "reservation_date", label: "Reservation date" },
  { key: "status", label: "Status" },
];

const emptyFilters = {
  flight_number: "",
  departure_date: "",
  departure_time: "",
  destination: "",
};

function filterRow(row: ManifestReportRow, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [
    row.pnr_number,
    row.passenger_name,
    row.class,
    row.agent,
    row.agency_company,
    row.passport_number,
    row.origin,
    row.destination,
    row.phone,
    row.reservation_date,
    row.status,
  ].some((value) => String(value || "").toLowerCase().includes(q));
}

export default function PortalMFestReportPage() {
  const { flightNumberOptions, loadingFlightNumbers } = useReportFlightNumbers();
  const {
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
  } = usePersistedPortalReport<ManifestReportRow>(
    PORTAL_REPORT_STORAGE_KEYS.manifest,
    emptyFilters,
  );
  const [loading, setLoading] = useState(false);
  const [departureTimes, setDepartureTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [airportOptions, setAirportOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<PortalReportPdfFile | null>(null);

  useEffect(() => {
    fetchAirportsForPortal()
      .then((airports) => setAirportOptions(buildAirportSelectOptions(airports)))
      .catch(() => setAirportOptions([]));
  }, []);

  const loadDepartureTimes = useCallback(async (flightNumber: string, departureDate: string) => {
    if (!flightNumber.trim() || !departureDate) {
      setDepartureTimes([]);
      return;
    }
    setLoadingTimes(true);
    try {
      const times = await getManifestDepartureTimes(flightNumber, departureDate);
      setDepartureTimes(times);
    } catch {
      setDepartureTimes([]);
    } finally {
      setLoadingTimes(false);
    }
  }, []);

  useEffect(() => {
    const flightNumber = filters.flight_number.trim();
    const departureDate = filters.departure_date;
    if (!flightNumber || !departureDate) {
      setDepartureTimes([]);
      return;
    }
    const timer = setTimeout(() => {
      void loadDepartureTimes(flightNumber, departureDate);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.flight_number, filters.departure_date, loadDepartureTimes]);

  const filteredRows = useMemo(
    () => rows.filter((row) => filterRow(row, inlineFilter)),
    [rows, inlineFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleSearch = async () => {
    const flightNumber = filters.flight_number.trim();
    if (!flightNumber) {
      toast.error("Flight number is required.");
      return;
    }
    if (!filters.departure_date) {
      toast.error("Departure date is required.");
      return;
    }

    setLoading(true);
    setSearched(true);
    setInlineFilter("");
    setPage(1);
    try {
      const result = await getManifestReport({
        flight_number: flightNumber,
        departure_date: filters.departure_date,
        departure_time: filters.departure_time || undefined,
        destination: filters.destination || undefined,
      });
      setRows(result.data ?? []);
      setAppliedFilters({ ...filters, flight_number: flightNumber });
      if (!result.data?.length) {
        toast.message("No passengers found for this flight.");
      }
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load manifest");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    resetReportState();
    setDepartureTimes([]);
  };

  const exportPlaceholder = (label: string) => {
    toast.message(`${label} export is not available yet.`);
  };

  const buildExportRows = () =>
    filteredRows.map((row) => ({
      pnr_number: row.pnr_number || "",
      passenger_name: row.passenger_name || "",
      class: row.class || "",
      agent: getAgentFirstName(row.agent, row.agent_first_name) || row.agent || "",
      agency_company: row.agency_company || "",
      passport_number: row.passport_number || "",
      origin: row.origin || "",
      destination: row.destination || "",
      phone: row.phone || "",
      reservation_date: row.reservation_date || "",
      status: row.status || "",
    }));

  const handleExportPdf = async () => {
    if (!searched || !appliedFilters.flight_number) {
      toast.error("Search and load results before exporting.");
      return;
    }
    if (!filteredRows.length) {
      toast.error("No rows to export.");
      return;
    }

    setExportingPdf(true);
    try {
      const file = await fetchPortalReportPdf({
        title: "Manifest",
        subtitle: buildReportSubtitle(appliedFilters),
        filename: `manifest-${appliedFilters.flight_number}-${appliedFilters.departure_date}.pdf`,
        reportKey: "manifest",
        columns: MANIFEST_PDF_COLUMNS,
        rows: buildExportRows(),
      });
      setPdfFile(file);
      setPdfPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!searched || !appliedFilters.flight_number) {
      toast.error("Search and load results before exporting.");
      return;
    }
    if (!filteredRows.length) {
      toast.error("No rows to export.");
      return;
    }

    setExportingExcel(true);
    try {
      exportPortalReportExcel({
        filename: `manifest-${appliedFilters.flight_number}-${appliedFilters.departure_date}`,
        columns: MANIFEST_PDF_COLUMNS,
        rows: buildExportRows(),
      });
      toast.success("Excel file downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold uppercase tracking-wide">M.Fest</h2>
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manifest-flight-number">
              Flight number <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={filters.flight_number}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  flight_number: value,
                  departure_time: "",
                }))
              }
              options={flightNumberOptions}
              placeholder="Select flight number"
              emptyMessage="No flight schedules found"
              isLoading={loadingFlightNumbers}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manifest-departure-date">
              Departure date <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="manifest-departure-date"
                type="date"
                value={filters.departure_date}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, departure_date: e.target.value }))
                }
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manifest-departure-time">Departure time</Label>
            <Select
              value={filters.departure_time || "__any__"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  departure_time: value === "__any__" ? "" : value,
                }))
              }
              disabled={!filters.flight_number.trim() || !filters.departure_date || loadingTimes}
            >
              <SelectTrigger id="manifest-departure-time" className="w-full">
                <SelectValue placeholder={loadingTimes ? "Loading times..." : "Any time"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any time</SelectItem>
                {departureTimes.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manifest-destination">Destination</Label>
            <SearchableSelect
              value={filters.destination}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, destination: value }))
              }
              options={airportOptions}
              placeholder="Any destination"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleSearch()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Search
          </Button>
          <Button type="button" variant="outline" onClick={handleClear} disabled={loading}>
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <ListSearch
            value={inlineFilter}
            onChange={(value) => {
              setInlineFilter(value);
              setPage(1);
            }}
            placeholder="Filter"
            className="max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => exportPlaceholder("Email")}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportPlaceholder("Message")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
              disabled={exportingExcel || loading}
              onClick={handleExportExcel}
            >
              {exportingExcel ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
              disabled={exportingPdf || loading}
              onClick={() => void handleExportPdf()}
            >
              {exportingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              PDF
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PNR number</TableHead>
              <TableHead>Passenger name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Passport number</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Reservation date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading manifest...
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  {searched
                    ? "No passengers match your search."
                    : "Enter flight details and search to view the manifest."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, index) => (
                <TableRow key={`${row.pnr_number}-${row.passenger_name}-${index}`}>
                  <TableCell className="font-medium">{row.pnr_number}</TableCell>
                  <TableCell>{row.passenger_name}</TableCell>
                  <TableCell>{row.class || "—"}</TableCell>
                  <TableCell>
                    <AgentNameCell name={row.agent} firstName={row.agent_first_name} />
                  </TableCell>
                  <TableCell>{row.agency_company || "—"}</TableCell>
                  <TableCell>{row.passport_number || "—"}</TableCell>
                  <TableCell>{row.origin || "—"}</TableCell>
                  <TableCell>{row.destination || "—"}</TableCell>
                  <TableCell>{row.phone || "—"}</TableCell>
                  <TableCell>{row.reservation_date || "—"}</TableCell>
                  <TableCell>
                    {row.status ? (
                      <StatusBadge status={row.status} kind="reservation" />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>Items per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span>
              {filteredRows.length === 0
                ? "0 of 0"
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                    currentPage * pageSize,
                    filteredRows.length,
                  )} of ${filteredRows.length}`}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= totalPages || filteredRows.length === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      </div>

      {searched && appliedFilters.flight_number ? (
        <p className="text-xs text-muted-foreground">
          Showing manifest for {appliedFilters.flight_number} on {appliedFilters.departure_date}
          {appliedFilters.departure_time ? ` at ${appliedFilters.departure_time}` : ""}
          {appliedFilters.destination ? ` · destination filter applied` : ""}
        </p>
      ) : null}

      <PortalReportPdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open) setPdfFile(null);
        }}
        title="Manifest"
        file={pdfFile}
      />
    </div>
  );
}
