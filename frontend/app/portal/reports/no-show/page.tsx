"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { ListSearch } from "@/components/portal/list-search";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { usePersistedPortalReport } from "@/hooks/use-persisted-portal-report";
import { useReportFlightNumbers } from "@/hooks/use-report-flight-numbers";
import { PORTAL_REPORT_STORAGE_KEYS } from "@/lib/portal-report-storage";
import { fetchAirportsForPortal } from "@/services/airport";
import { buildAirportSelectOptions } from "@/lib/airport-select";
import {
  getManifestDepartureTimes,
  getNoShowReport,
  type NoShowReportRow,
} from "@/services/portal";
import { Badge } from "@/components/ui/badge";
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

const NO_SHOW_PDF_COLUMNS: PortalReportPdfColumn[] = [
  { key: "flight_no", label: "Flight no" },
  { key: "departure_date", label: "Departure date" },
  { key: "pnr_number", label: "PNR number" },
  { key: "passenger_name", label: "Passenger name" },
  { key: "ticket_type", label: "Ticket type" },
  { key: "agent", label: "Agent" },
  { key: "passport_number", label: "Passport number" },
  { key: "destination", label: "Destination" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
];

const emptyFilters = {
  flight_number: "",
  departure_date: "",
  departure_time: "",
  destination: "",
};

function formatDepartureDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function filterRow(row: NoShowReportRow, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [
    row.flight_no,
    row.departure_date,
    row.pnr_number,
    row.passenger_name,
    row.ticket_type,
    row.agent,
    row.passport_number,
    row.destination,
    row.phone,
    row.status,
  ].some((value) => String(value || "").toLowerCase().includes(q));
}

export default function PortalNoShowReportPage() {
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
  } = usePersistedPortalReport<NoShowReportRow>(
    PORTAL_REPORT_STORAGE_KEYS.noShow,
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
      const result = await getNoShowReport({
        flight_number: flightNumber,
        departure_date: filters.departure_date,
        departure_time: filters.departure_time || undefined,
        destination: filters.destination || undefined,
      });
      setRows(result.data ?? []);
      setAppliedFilters({ ...filters, flight_number: flightNumber });
      if (!result.data?.length) {
        toast.message("No no-show passengers found for this flight.");
      }
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load no-show report");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    resetReportState();
    setDepartureTimes([]);
  };

  const buildExportRows = () =>
    filteredRows.map((row) => ({
      flight_no: row.flight_no || "",
      departure_date: formatDepartureDate(row.departure_date),
      pnr_number: row.pnr_number || "",
      passenger_name: row.passenger_name || "",
      ticket_type: row.ticket_type || "",
      agent: row.agent || "",
      passport_number: row.passport_number || "",
      destination: row.destination || "",
      phone: row.phone || "",
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
        title: "NO SHOW REPORT",
        subtitle: buildReportSubtitle(appliedFilters, "Departed or arrived flights only"),
        filename: `no-show-${appliedFilters.flight_number}-${appliedFilters.departure_date}.pdf`,
        reportKey: "no_show",
        columns: NO_SHOW_PDF_COLUMNS,
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
        filename: `no-show-${appliedFilters.flight_number}-${appliedFilters.departure_date}`,
        columns: NO_SHOW_PDF_COLUMNS,
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
        <h2 className="text-2xl font-semibold uppercase tracking-wide">No show report</h2>
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
          Passengers who were confirmed and paid but never checked in after the flight departed.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="noshow-flight-number">
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
            <Label htmlFor="noshow-departure-date">
              Departure date <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="noshow-departure-date"
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
            <Label htmlFor="noshow-departure-time">Departure time</Label>
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
              <SelectTrigger id="noshow-departure-time" className="w-full">
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
            <Label htmlFor="noshow-destination">Destination</Label>
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
              className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
              disabled={exportingExcel || loading}
              onClick={handleExportExcel}
            >
              {exportingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
              disabled={exportingPdf || loading}
              onClick={() => void handleExportPdf()}
            >
              {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              PDF
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flight no</TableHead>
              <TableHead>Departure date</TableHead>
              <TableHead>PNR number</TableHead>
              <TableHead>Passenger name</TableHead>
              <TableHead>Ticket type</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Passport number</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading no-show report...
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  {searched
                    ? "No no-show passengers match your search."
                    : "Enter flight details and search to view no-show passengers."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, index) => (
                <TableRow key={`${row.pnr_number}-${row.passenger_name}-${index}`}>
                  <TableCell className="font-medium">{row.flight_no}</TableCell>
                  <TableCell>{formatDepartureDate(row.departure_date)}</TableCell>
                  <TableCell>{row.pnr_number}</TableCell>
                  <TableCell>{row.passenger_name}</TableCell>
                  <TableCell>{row.ticket_type || "—"}</TableCell>
                  <TableCell>{row.agent || "—"}</TableCell>
                  <TableCell>{row.passport_number || "—"}</TableCell>
                  <TableCell>{row.destination || "—"}</TableCell>
                  <TableCell>{row.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                      {row.status}
                    </Badge>
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
          Showing no-shows for {appliedFilters.flight_number} on {appliedFilters.departure_date}
          {appliedFilters.departure_time ? ` at ${appliedFilters.departure_time}` : ""}
          {appliedFilters.destination ? " · destination filter applied" : ""}
          {" · only departed or arrived flights"}
        </p>
      ) : null}

      <PortalReportPdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open) setPdfFile(null);
        }}
        title="No show report"
        file={pdfFile}
      />
    </div>
  );
}
