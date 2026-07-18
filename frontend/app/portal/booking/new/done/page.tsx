"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BookingFlowLayout } from "@/components/portal/office-booking/booking-flow-layout";
import { PassengerTicketPrintButton } from "@/components/portal/passenger-ticket-print-button";
import { Button } from "@/components/ui/button";
import { clearOfficeBookingDraft } from "@/lib/office-booking-store";
import { bookingReference } from "@/lib/booking-reference";
import { isPassengerTicketPrintable } from "@/lib/passenger-ticket";
import { useCurrency } from "@/contexts/currency-context";
import { fetchBookingDetails, type BookingDetails } from "@/services/airBooking";

function DoneContent() {
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const ref = searchParams.get("ref") || searchParams.get("pnr") || "";
  const paid = searchParams.get("paid") === "1";
  const total = searchParams.get("total");

  const [detail, setDetail] = useState<BookingDetails | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    clearOfficeBookingDraft();
  }, []);

  useEffect(() => {
    if (!ref || !paid) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingTickets(true);
    fetchBookingDetails(ref)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTickets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ref, paid]);

  const printablePassengers =
    detail?.passengers.filter((p) => isPassengerTicketPrintable(detail, p)) ?? [];
  const bookingRef = detail ? bookingReference(detail) : ref;

  return (
    <BookingFlowLayout
      title="Booking complete"
      description={
        paid
          ? "Saved as Confirm — paid and PNR issued."
          : "Saved as Booked — payment still pending."
      }
    >
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="mb-4 h-14 w-14 text-gold" />
        <p className="text-sm text-muted-foreground">
          {paid ? "PNR" : "Reservation reference"}
        </p>
        <p className="text-2xl font-semibold">{ref || "—"}</p>
        {total && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{formatMoney(parseFloat(total))}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {paid ? "Confirm — paid, invoice created" : "Booked — payment pending"}
        </p>
      </div>

      {paid ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium">Print tickets</p>
          {loadingTickets ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading passengers…
            </p>
          ) : printablePassengers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tickets are not ready to print yet. Open the booking from Bookings when ticket
              numbers are issued.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.passengers.map((p, index) =>
                isPassengerTicketPrintable(detail, p) ? (
                  <li
                    key={p.row_name || `${p.name}-${index}`}
                    className="flex flex-col gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-left">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.type}
                        {p.ticket_number ? ` · ${p.ticket_number}` : ""}
                      </p>
                    </div>
                    <PassengerTicketPrintButton
                      bookingRef={bookingRef}
                      passengerRow={p.row_name}
                      passengerIndex={index}
                      passengerName={p.name}
                      size="default"
                    />
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-center">
        <Button className="bg-gold text-navy hover:bg-gold-dark" asChild>
          <Link href="/portal/booking/new">New office booking</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/portal/bookings">View all bookings</Link>
        </Button>
      </div>
    </BookingFlowLayout>
  );
}

export default function OfficeBookingDonePage() {
  return (
    <Suspense
      fallback={
        <BookingFlowLayout title="Booking complete">
          <p className="text-muted-foreground">Loading...</p>
        </BookingFlowLayout>
      }
    >
      <DoneContent />
    </Suspense>
  );
}
