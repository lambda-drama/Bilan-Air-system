"use client";

import Link from "next/link";
import { Calendar, Plane, Repeat } from "lucide-react";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listFlightSetups, type FlightSetupRow } from "@/services/flightSchedule";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FlightSetupPage() {
  const {
    search,
    setSearch,
    rows,
    loading,
    error,
  } = useLiveListQuery<FlightSetupRow>(
    (query) => listFlightSetups({ limit: 200, search: query.trim() || undefined }).then((r) => r.data),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flight setup</h1>
          <p className="text-muted-foreground">
            One row per flight number. The same number runs on many dates — open schedules to see each
            departure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/portal/flights">All departures</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/portal/flights/recurring">
              <Repeat className="mr-2 h-4 w-4" />
              Recurring plans
            </Link>
          </Button>
          <Button className="bg-gold text-navy hover:bg-gold-dark" asChild>
            <Link href="/portal/flights">New departure</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-gold" />
              Flight numbers
            </CardTitle>
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter flight number..."
              className="w-full sm:max-w-sm"
            />
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
                    <TableHead>Flight number</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Aircraft</TableHead>
                    <TableHead>Schedules</TableHead>
                    <TableHead>Next departure</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        {search.trim()
                          ? "No flight numbers match your filter."
                          : "No flight schedules yet — create a departure or recurring plan."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.flight_number}>
                        <TableCell className="font-semibold">{row.flight_number}</TableCell>
                        <TableCell>{row.origin_label || "—"}</TableCell>
                        <TableCell>{row.destination_label || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {row.airplane_label || row.airplane || "—"}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{row.schedule_count}</span>
                          {row.first_departure && row.last_departure ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(row.first_departure)} – {formatDate(row.last_departure)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {row.next_departure ? (
                            <>
                              {formatDate(row.next_departure)}
                              {row.next_departure_time ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  {row.next_departure_time.slice(0, 5)}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{row.updated_by || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(row.updated_on)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gold hover:text-gold-dark"
                              asChild
                              title="View departures for this flight number"
                            >
                              <Link
                                href={`/portal/flights?flight_number=${encodeURIComponent(row.flight_number)}`}
                              >
                                <Plane className="h-4 w-4" />
                              </Link>
                            </Button>
                            {row.schedule_plan ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                                title="Recurring plan"
                              >
                                <Link href="/portal/flights/recurring">
                                  <Repeat className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              asChild
                              title="All departures (calendar view)"
                            >
                              <Link
                                href={`/portal/flights?flight_number=${encodeURIComponent(row.flight_number)}`}
                              >
                                <Calendar className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
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
