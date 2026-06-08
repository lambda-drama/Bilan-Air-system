"use client";

import { useState } from "react";
import { Loader2, PlusCircle, Search } from "lucide-react";
import { fetchBookingDetails, type BookingDetails } from "@/services/airBooking";
import { traceBaggage, type BaggageTraceResult } from "@/services/baggage";
import { BookingBaggagePanel } from "@/components/portal/booking-baggage-panel";
import { BookingPnrSearch } from "@/components/portal/booking-pnr-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailRow, DetailSection } from "@/components/portal/detail-sheet";
import { bookingReference } from "@/lib/booking-reference";

export default function PortalBaggagePage() {
  const [pnr, setPnr] = useState("");
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const [tracking, setTracking] = useState("");
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState("");
  const [traceResult, setTraceResult] = useState<BaggageTraceResult | null>(null);

  const lookupByPnr = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBookingLoading(true);
    setBookingError("");
    setBooking(null);
    try {
      const detail = await fetchBookingDetails(trimmed);
      setBooking(detail);
      setPnr(bookingReference(detail));
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "Booking not found");
    } finally {
      setBookingLoading(false);
    }
  };

  const refreshBooking = async () => {
    if (!booking) return;
    const detail = await fetchBookingDetails(bookingReference(booking));
    setBooking(detail);
  };

  const handleTrace = async () => {
    const code = tracking.trim();
    if (!code) return;
    setTraceLoading(true);
    setTraceError("");
    setTraceResult(null);
    try {
      const data = await traceBaggage(code);
      setTraceResult(data);
      setTracking(data.tracking_number);
    } catch (e) {
      setTraceError(e instanceof Error ? e.message : "Baggage not found");
    } finally {
      setTraceLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Baggage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create tags for a booking (tracking number is generated automatically) or look up an
          existing tag.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-medium">Create baggage tag</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Search by reservation ref, PNR, payer name, phone, or email. Pick a booking, enter each
          bag&apos;s weight,
          then <strong>Create tag</strong>. Numbers follow{" "}
          <span className="font-mono">001-PNR</span>, <span className="font-mono">002-PNR</span>, …
        </p>
        <div className="rounded-lg border bg-card p-4">
          <BookingPnrSearch
            pnr={pnr}
            onPnrChange={setPnr}
            onLookup={lookupByPnr}
            onClear={() => {
              setBooking(null);
              setBookingError("");
            }}
            loading={bookingLoading}
            loadLabel="Load booking"
          />
        </div>
        {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}

        {booking && (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Booking</span>{" "}
              <span className="font-semibold">{booking.reservation_ref}</span>
              {booking.pnr ? (
                <>
                  {" "}
                  · <span className="text-muted-foreground">PNR</span> {booking.pnr}
                </>
              ) : null}
              {booking.payer_name ? (
                <>
                  {" "}
                  · <span className="text-muted-foreground">Payer</span> {booking.payer_name}
                </>
              ) : null}
            </p>
            <BookingBaggagePanel
              bookingRef={bookingReference(booking)}
              travelers={booking.passengers.map((p) => ({
                name: p.name,
                seat_class: p.seat_class,
                baggage_policy: p.baggage_policy,
              }))}
              baggage={booking.baggage || []}
              policy={booking.baggage_policy}
              baggageFeesTotal={booking.baggage_fees_total}
              onUpdated={refreshBooking}
            />
          </div>
        )}
      </section>

      <section className="space-y-3 border-t pt-8">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-medium">Trace existing tag</h3>
        </div>
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Tracking number e.g. 001-BA-00001"
            value={tracking}
            onChange={(e) => setTracking(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleTrace()}
          />
          <Button variant="outline" className="shrink-0" onClick={handleTrace} disabled={traceLoading || !tracking.trim()}>
            {traceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Trace
          </Button>
        </div>
        {traceError && <p className="text-sm text-destructive">{traceError}</p>}

        {traceResult && (
          <div className="rounded-lg border bg-card p-4">
            <DetailSection title="Baggage tag">
              <DetailRow label="Tracking #" value={traceResult.tracking_number} />
              <DetailRow label="Status" value={traceResult.status} />
              <DetailRow label="Traveler" value={traceResult.passenger_name || traceResult.passenger} />
              <DetailRow label="Weight" value={`${traceResult.weight_kg} kg`} />
              <DetailRow label="Flight schedule" value={traceResult.flight} />
            </DetailSection>
          </div>
        )}
      </section>
    </div>
  );
}
