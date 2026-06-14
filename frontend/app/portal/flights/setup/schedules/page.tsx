"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Armchair, LayoutGrid, Plane, Ticket, X } from "lucide-react";
import { ListSearch } from "@/components/portal/list-search";
import { RowActionMenu, RowActionMenuItem } from "@/components/portal/row-action-menu";
import { StatusBadge } from "@/components/portal/status-badge";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { flightSetupPath } from "@/services/flightSetup";
import { getFlightSchedulePlan } from "@/services/flightSchedulePlan";
import { listSchedules, type FlightScheduleRow } from "@/services/flightSchedule";

const ALL_STATUSES_VALUE = "all";
const UPCOMING_STATUSES_VALUE = "upcoming";

const STATUS_OPTIONS = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Delayed", label: "Delayed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Departed", label: "Departed" },
  { value: "Arrived", label: "Arrived" },
];

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FlightSetupSchedulesContent() {
  const searchParams = useSearchParams();
  const flightNumber = decodeURIComponent(searchParams.get("flight_number") || "");
  const schedulePlan = decodeURIComponent(searchParams.get("schedule_plan") || "");
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [planFlightNumber, setPlanFlightNumber] = useState<string | null>(null);
  const [departureDateFilter, setDepartureDateFilter] = useState("");
  const [departureTimeFilter, setDepartureTimeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES_VALUE);

  useEffect(() => {
    if (!schedulePlan) {
      setPlanTitle(null);
      setPlanFlightNumber(null);
      return;
    }
    getFlightSchedulePlan(schedulePlan)
      .then((doc) => {
        setPlanTitle(String(doc.plan_title || schedulePlan));
        setPlanFlightNumber(doc.flight_number ? String(doc.flight_number) : null);
      })
      .catch(() => {
        setPlanTitle(schedulePlan);
        setPlanFlightNumber(null);
      });
  }, [schedulePlan]);

  const displayFlightNumber = flightNumber || planFlightNumber || "";

  const fetchRows = useCallback(
    async (search: string) => {
      if (!flightNumber && !schedulePlan) return [];
      const res = await listSchedules({
        limit: 200,
        flight_number: schedulePlan ? undefined : flightNumber || undefined,
        schedule_plan: schedulePlan || undefined,
        search: search.trim() || undefined,
        departure_date: departureDateFilter.trim() || undefined,
        departure_time: departureTimeFilter.trim() || undefined,
        status:
          statusFilter === ALL_STATUSES_VALUE || statusFilter === UPCOMING_STATUSES_VALUE
            ? undefined
            : statusFilter,
        upcoming: statusFilter === UPCOMING_STATUSES_VALUE,
      });
      return res.data;
    },
    [flightNumber, schedulePlan, departureDateFilter, departureTimeFilter, statusFilter],
  );

  const listReloadKey = `${flightNumber}|${schedulePlan}|${departureDateFilter}|${departureTimeFilter}|${statusFilter}`;

  const { search, setSearch, rows, loading, error } = useLiveListQuery<FlightScheduleRow>(
    fetchRows,
    { reloadKey: listReloadKey },
  );

  const hasListFilters =
    !!search.trim() ||
    !!departureDateFilter ||
    !!departureTimeFilter ||
    statusFilter !== ALL_STATUSES_VALUE;

  const clearPlanFilterHref = displayFlightNumber
    ? flightSetupPath(displayFlightNumber, "schedules")
    : "/portal/flights";

  if (!flightNumber && !schedulePlan) {
    return (
      <p className="text-muted-foreground">
        Missing flight number.{" "}
        <Link href="/portal/flights/setup" className="text-gold hover:underline">
          Back to flight setup
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/portal/flights/setup" className="text-sm text-gold hover:underline">
            ← Flight setup
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            Schedules{displayFlightNumber ? ` — ${displayFlightNumber}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Individual dated departures generated from recurring plans or added manually.
          </p>
          {schedulePlan ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 font-normal">
                Recurring plan: {planTitle || schedulePlan}
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                <Link href={clearPlanFilterHref}>
                  <X className="mr-1 h-3 w-3" />
                  Clear plan filter
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link
              href={
                displayFlightNumber
                  ? flightSetupPath(displayFlightNumber, "plans")
                  : "/portal/flights/recurring"
              }
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Recurring plans
            </Link>
          </Button>
          {displayFlightNumber ? (
            <Button className="bg-gold text-navy hover:bg-gold-dark" asChild>
              <Link
                href={`/portal/flights?flight_number=${encodeURIComponent(displayFlightNumber)}`}
              >
                Manage in full editor
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <ListSearch
                value={search}
                onChange={setSearch}
                placeholder="Search flight no. or ID..."
                className="w-full sm:w-[240px] sm:max-w-none"
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="setup-schedule-date-filter"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Departure date
                </label>
                <Input
                  id="setup-schedule-date-filter"
                  type="date"
                  value={departureDateFilter}
                  onChange={(e) => setDepartureDateFilter(e.target.value)}
                  className="h-9 w-full sm:w-[160px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="setup-schedule-time-filter"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Time <span className="font-normal">(optional)</span>
                </label>
                <Input
                  id="setup-schedule-time-filter"
                  type="time"
                  value={departureTimeFilter}
                  onChange={(e) => setDepartureTimeFilter(e.target.value)}
                  className="h-9 w-full sm:w-[140px]"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 xl:ml-auto xl:shrink-0">
              <label
                htmlFor="setup-schedule-status-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="setup-schedule-status-filter" className="h-9 w-full sm:w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
                  <SelectItem value={UPCOMING_STATUSES_VALUE}>Upcoming</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schedule ID</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {hasListFilters
                          ? "No departures match your filters."
                          : schedulePlan
                            ? "No departures generated from this recurring plan yet."
                            : "No departures for this flight number yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-mono text-sm">{row.name}</TableCell>
                        <TableCell>
                          {formatDate(row.departure_date)}{" "}
                          <span className="text-muted-foreground">
                            {row.departure_time?.slice(0, 5)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {formatDate(row.arrival_date)}{" "}
                          <span className="text-muted-foreground">
                            {row.arrival_time?.slice(0, 5)}
                          </span>
                        </TableCell>
                        <TableCell>{row.route_label || row.route}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} kind="flight_schedule" />
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActionMenu>
                            <RowActionMenuItem
                              icon={Armchair}
                              accent
                              href={`/portal/seat-inventory?schedule=${encodeURIComponent(row.name)}`}
                            >
                              Reserve seats
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Ticket}
                              accent
                              href={`/portal/booking/new/seats?schedule=${encodeURIComponent(row.name)}`}
                            >
                              Book flight
                            </RowActionMenuItem>
                            <RowActionMenuItem
                              icon={Plane}
                              accent
                              href={`/portal/flights?flight_number=${encodeURIComponent(row.flight_number || displayFlightNumber)}`}
                            >
                              Open in all departures
                            </RowActionMenuItem>
                          </RowActionMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FlightSetupSchedulesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <FlightSetupSchedulesContent />
    </Suspense>
  );
}
