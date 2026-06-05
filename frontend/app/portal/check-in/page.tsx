"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import {
  checkInAllPassengers,
  checkInPassenger,
  fetchBookingDetails,
  type BookingDetails,
} from "@/services/airBooking";
import { openDocumentPrintView } from "@/services/common";
import { PrintFormatDropdown } from "@/components/portal/print-format-dropdown";
import { BookingBaggagePanel } from "@/components/portal/booking-baggage-panel";
import { BookingPnrSearch } from "@/components/portal/booking-pnr-search";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { bookingReference } from "@/lib/booking-reference";

export default function PortalCheckInPage() {
  const { formatMoney } = useCurrency();
  const [pnr, setPnr] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | "all" | null>(null);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [checkInWeights, setCheckInWeights] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const lookupByPnr = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setBooking(null);
    try {
      const detail = await fetchBookingDetails(trimmed);
      setBooking(detail);
      setPnr(bookingReference(detail));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking not found");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!booking) return;
    const detail = await fetchBookingDetails(bookingReference(booking));
    setBooking(detail);
  };

  const parseCheckInWeight = (index: number) => {
    const raw = checkInWeights[index]?.trim();
    if (!raw) return undefined;
    const w = parseFloat(raw);
    return w > 0 ? w : undefined;
  };

  const handleCheckInOne = async (index: number) => {
    if (!booking) return;
    setCheckingIn(index);
    try {
      await checkInPassenger(bookingReference(booking), index, parseCheckInWeight(index));
      toast.success(`Traveler ${index + 1} checked in`);
      setCheckInWeights((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingIn(null);
    }
  };

  const handleCheckInAll = async () => {
    if (!booking) return;
    setCheckingIn("all");
    try {
      await checkInAllPassengers(bookingReference(booking));
      toast.success("All travelers checked in");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingIn(null);
    }
  };

  const canCheckIn =
    booking?.payment_status === "Paid" &&
    booking.status !== "Void" &&
    booking.status !== "Cancelled";
  const allCheckedIn =
    booking?.passengers?.every((p) =>
      ["Checked In", "Boarded"].includes(p.check_in_status || ""),
    ) ?? false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Check-in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by reservation ref, PNR, payer name, phone, or email. Pick a suggestion to load
          the booking.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          <strong>Tickets:</strong> issued when payment is confirmed (ticket numbers on each
          traveler).           <strong>Boarding pass:</strong> printed at check-in for each traveler who is
          flying. <strong>Baggage:</strong> enter weight to issue a tag (excess fees apply per BA
          Settings).
        </p>
        <BookingPnrSearch
          pnr={pnr}
          onPnrChange={setPnr}
          onLookup={lookupByPnr}
          onClear={() => {
            setBooking(null);
            setError("");
          }}
          loading={loading}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {booking && (
        <>
          <div className="rounded-lg border bg-card p-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Reservation</p>
              <p className="font-semibold">{booking.reservation_ref}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PNR</p>
              <p className="font-semibold">{booking.pnr || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payer</p>
              <p className="font-semibold">{booking.payer_name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment</p>
              <p className="font-semibold">{booking.payment_status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Booking status</p>
              <p className="font-semibold">{booking.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold">{formatMoney(booking.total_fare)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Flight</p>
              <p className="font-semibold">
                {booking.flight.flight_number} · {booking.flight.origin} →{" "}
                {booking.flight.destination}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.flight.departure_date} {booking.flight.departure_time}
              </p>
            </div>
          </div>

          {booking.payment_status !== "Paid" && (
            <p className="text-sm text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              Payment is not complete. Confirm payment on the{" "}
              <a href="/portal/bookings" className="font-medium underline">
                Bookings
              </a>{" "}
              page before check-in.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {booking.payment_status === "Paid" && (
              <PrintFormatDropdown
                doctype="Air Booking"
                docName={booking.reservation_ref}
                variant="default"
              />
            )}
            {canCheckIn && !allCheckedIn && (
              <Button
                variant="outline"
                disabled={checkingIn !== null}
                onClick={handleCheckInAll}
              >
                {checkingIn === "all" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Check in all travelers
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Traveler</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booking.passengers.map((p, index) => {
                  const checkedIn = ["Checked In", "Boarded"].includes(
                    p.check_in_status || "",
                  );
                  return (
                    <TableRow key={`${p.name}-${index}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell>{p.seat_label || p.seat}</TableCell>
                      <TableCell>{p.ticket_number || "—"}</TableCell>
                      <TableCell>{p.check_in_status || "Not Checked In"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {canCheckIn && !checkedIn && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checkingIn !== null}
                            onClick={() => handleCheckInOne(index)}
                          >
                            {checkingIn === index ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Check in"
                            )}
                          </Button>
                        )}
                        {checkedIn && (
                          <Button
                            size="sm"
                            className="bg-gold text-navy hover:bg-gold-dark"
                            onClick={() =>
                              openDocumentPrintView("Air Booking", booking.reservation_ref, "Standard", {
                                triggerPrint: 1,
                              })
                            }
                          >
                            <Printer className="mr-1 h-3.5 w-3.5" />
                            Print pass
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <BookingBaggagePanel
            bookingRef={bookingReference(booking)}
            travelers={booking.passengers.map((p) => ({ name: p.name }))}
            baggage={booking.baggage || []}
            policy={booking.baggage_policy}
            baggageFeesTotal={booking.baggage_fees_total}
            onUpdated={refresh}
            showCheckInWeights
            checkInWeights={checkInWeights}
            onCheckInWeightChange={(index, value) =>
              setCheckInWeights((prev) => ({ ...prev, [index]: value }))
            }
          />
        </>
      )}
    </div>
  );
}
