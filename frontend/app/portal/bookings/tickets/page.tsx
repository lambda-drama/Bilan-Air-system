"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { listPassengerTickets, type PassengerTicketRow } from "@/services/portal";
import { ListSearch } from "@/components/portal/list-search";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { PassengerTicketPrintButton } from "@/components/portal/passenger-ticket-print-button";
import { BookingStartLink } from "@/components/portal/booking-start-link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PortalTicketsPage() {
  const fetchTickets = useCallback(async (search: string) => {
    const res = await listPassengerTickets({ search: search.trim() || undefined, limit: 200 });
    return res.data;
  }, []);

  const { search, setSearch, rows, loading, error } = useLiveListQuery<PassengerTicketRow>(
    fetchTickets,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" asChild>
            <Link href="/portal/bookings">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to bookings
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold">All tickets</h2>
          <p className="text-sm text-muted-foreground">
            Issued passenger tickets from confirmed reservations
          </p>
        </div>
        <BookingStartLink>Office booking</BookingStartLink>
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search ticket no., passenger, PNR, reservation ref..."
        className="w-full sm:max-w-md"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Passenger</TableHead>
                <TableHead>PNR</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Booked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {search.trim() ? "No tickets match your search." : "No issued tickets yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.passenger_row}>
                    <TableCell className="font-mono text-sm">{row.ticket_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.passenger_name}</p>
                        <p className="text-xs text-muted-foreground">{row.passenger_type}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.pnr || "—"}</TableCell>
                    <TableCell>
                      <div>
                        <p>{row.flight_number || row.flight_schedule}</p>
                        {row.departure_date ? (
                          <p className="text-xs text-muted-foreground">{row.departure_date}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.seat_label || row.seat_number || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.booking_date || "—"}</TableCell>
                    <TableCell className="text-right">
                      <PassengerTicketPrintButton
                        bookingRef={row.reservation_ref}
                        passengerRow={row.passenger_row}
                        passengerName={row.passenger_name}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
