"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Check,
  Loader2,
  Plane,
  Radio,
  User,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoardingPassCard } from "@/components/check-in/boarding-pass-card";
import { Reveal } from "@/components/motion/reveal";
import { useLocale } from "@/contexts/locale-context";
import { formatClock, getCheckInPageContent } from "@/lib/content/check-in-page";
import { formatFlightRouteLabel } from "@/lib/format-airport";
import {
  lookupBookingForCheckin,
  selfCheckInAll,
  type BoardingPass,
  type CheckInBooking,
} from "@/services/checkIn";
import { bookingReference } from "@/lib/booking-reference";
import { cn } from "@/lib/utils";

type Step = "find" | "confirm" | "complete";

function StepIndicator({ steps, current }: { steps: [string, string, string]; current: Step }) {
  const index = current === "find" ? 0 : current === "confirm" ? 1 : 2;

  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((label, i) => (
        <div key={label} className="contents">
          <div
            className={cn(
              "flex items-center gap-2",
              i <= index ? "text-gold" : "text-navy/40",
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                i < index
                  ? "bg-gold text-navy"
                  : i === index
                    ? "bg-gold text-navy"
                    : "bg-navy/10 text-navy/40",
              )}
            >
              {i < index ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px bg-navy/20 min-w-4" />}
        </div>
      ))}
    </div>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const { locale, isRtl } = useLocale();
  const copy = useMemo(() => getCheckInPageContent(locale), [locale]);

  const initialPnr = searchParams.get("pnr") || "";

  const [step, setStep] = useState<Step>("find");
  const [pnr, setPnr] = useState(initialPnr);
  const [lastName, setLastName] = useState("");
  const [booking, setBooking] = useState<CheckInBooking | null>(null);
  const [boardingPasses, setBoardingPasses] = useState<BoardingPass[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState("");

  const buildBoardingPassesFromBooking = useCallback((b: CheckInBooking): BoardingPass[] => {
    const origin = b.flight.origin_code || b.flight.origin;
    const dest = b.flight.destination_code || b.flight.destination;
    const originLabel = b.flight.origin_label || origin;
    const destLabel = b.flight.destination_label || dest;
    return b.passengers
      .filter((p) => ["Checked In", "Boarded"].includes(p.check_in_status || ""))
      .map((p, index) => ({
        airline_name: "BILAN AIR",
        airline_tagline: "Beyond Skies Together",
        passenger_name: (p.name || "").toUpperCase(),
        passenger_type: p.type || "Adult",
        sequence_no: index + 1,
        booking_ref: b.pnr || bookingReference(b),
        reservation_ref: b.reservation_ref || bookingReference(b),
        pnr: b.pnr || bookingReference(b),
        ticket_number: p.ticket_number,
        seat: p.seat_label || p.seat,
        flight_number: b.flight.flight_number,
        origin_code: origin,
        destination_code: dest,
        origin_label: originLabel,
        destination_label: destLabel,
        departure_date: b.flight.departure_date,
        departure_time: b.flight.departure_time,
        arrival_time: b.flight.arrival_time,
        boarding_time: b.flight.departure_time,
        gate_close_time: b.flight.departure_time,
        gate: "TBC",
        zone: String(index + 1),
        seat_class: "Economy",
        check_in_status: p.check_in_status,
        barcode_data: `${b.pnr || bookingReference(b)}|${p.ticket_number || ""}|${origin}|${dest}|${b.flight.flight_number}|${p.seat_label || p.seat}`,
      }));
  }, []);

  const handleFind = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pnr.trim()) return;

    setLoading(true);
    setError("");
    try {
      const result = await lookupBookingForCheckin(pnr, lastName);
      setBooking(result);

      if (result.all_checked_in) {
        setBoardingPasses(buildBoardingPassesFromBooking(result));
        setStep("complete");
      } else {
        setStep("confirm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.find.notFound);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!booking) return;
    setCheckingIn(true);
    setError("");
    try {
      const result = await selfCheckInAll(bookingReference(booking), lastName);
      setBooking(result.booking);
      setBoardingPasses(result.boarding_passes);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  };

  useEffect(() => {
    if (initialPnr) {
      setPnr(initialPnr.toUpperCase());
    }
  }, [initialPnr]);

  const carryOnKg = booking?.baggage_policy?.carry_on_kg ?? 7;
  const checkedKg = booking?.baggage_policy?.max_baggage_kg ?? 23;

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4">
              {copy.hero.eyebrow}
            </p>
            <h1 className="text-cream font-serif text-4xl md:text-5xl mb-3">{copy.hero.title}</h1>
            <p className="text-cream/70 max-w-xl">{copy.hero.body}</p>
          </Reveal>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step !== "find" && <StepIndicator steps={copy.steps} current={step} />}

        {step === "find" && (
          <Reveal>
            <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6 md:p-8">
              <h2 className="text-navy font-semibold text-xl mb-2">{copy.find.title}</h2>
              <p className="text-navy/60 text-sm mb-6">{copy.find.body}</p>

              <form onSubmit={handleFind} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                    {copy.find.pnr} *
                  </label>
                  <Input
                    value={pnr}
                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                    placeholder="CA-0002 or RES-00001"
                    className="bg-cream/50"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold tracking-wide text-navy/60 mb-2 block">
                    {copy.find.lastName} *
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="bg-cream/50"
                    required
                    autoComplete="family-name"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !pnr.trim() || !lastName.trim()}
                  className="w-full sm:w-auto bg-gold hover:bg-gold-dark text-navy font-semibold gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {copy.find.submit}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </Reveal>
        )}

        {step === "confirm" && booking && (
          <div className="space-y-6">
            <Reveal>
              <div className="bg-white rounded-2xl border border-navy/10 p-6 md:p-8">
                <h2 className="text-navy font-semibold text-xl mb-2">{copy.confirm.title}</h2>
                <p className="text-navy/60 text-sm mb-6">{copy.confirm.body}</p>

                <div className="rounded-xl border border-navy/10 p-4 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-3">
                    {copy.confirm.flight}
                  </p>
                  <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
                    <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                      <Plane className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <p className="text-gold font-semibold">{booking.flight.flight_number}</p>
                      <p className="text-navy/60 text-sm">
                        {formatFlightRouteLabel({
                          origin_code: booking.flight.origin_code || booking.flight.origin,
                          destination_code:
                            booking.flight.destination_code || booking.flight.destination,
                          origin_label: booking.flight.origin_label,
                          destination_label: booking.flight.destination_label,
                        })}
                      </p>
                      <p className="text-navy/60 text-sm">
                        {booking.flight.departure_date} ·{" "}
                        {formatClock(booking.flight.departure_time)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-navy/10 p-4 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/50 mb-3">
                    {copy.confirm.passengers}
                  </p>
                  <div className="space-y-3">
                    {booking.passengers.map((p) => (
                      <div
                        key={`${p.name}-${p.seat}`}
                        className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}
                      >
                        <div className="w-10 h-10 bg-navy/10 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-navy" />
                        </div>
                        <div>
                          <p className="text-navy font-medium">{p.name}</p>
                          <p className="text-navy/60 text-sm">
                            {p.type} · Seat {p.seat_label || p.seat}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-cream/80 border border-navy/10 p-4">
                  <p className="text-navy font-semibold mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {copy.confirm.baggageTitle}
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm text-navy/70">
                    <span>🎒 1 {copy.confirm.carryOn} ({carryOnKg}kg)</span>
                    <span>🧳 1 {copy.confirm.checkedBag} ({checkedKg}kg)</span>
                  </div>
                </div>
              </div>
            </Reveal>

            {booking.payment_status !== "Paid" && (
              <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 p-4">
                {copy.confirm.paymentRequired}
              </p>
            )}

            {!booking.check_in_window.open && booking.payment_status === "Paid" && (
              <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 p-4">
                {copy.confirm.windowClosed}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}

            <div className={cn("flex flex-wrap gap-3", isRtl && "flex-row-reverse")}>
              <Button
                onClick={handleCheckIn}
                disabled={!booking.can_check_in || checkingIn}
                className="bg-gold hover:bg-gold-dark text-navy font-semibold min-w-[200px]"
              >
                {checkingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  copy.confirm.complete
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep("find")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6">
            <Reveal>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-navy font-serif text-2xl mb-2">{copy.complete.title}</h2>
                <p className="text-navy/60">{copy.complete.body}</p>
              </div>
            </Reveal>

            <div id="boarding-passes" className="space-y-6">
              {boardingPasses.map((pass, index) => (
                <BoardingPassCard
                  key={`${pass.pnr}-${pass.passenger_name}`}
                  pass={pass}
                  bookingRef={booking ? bookingReference(booking) : pass.booking_ref}
                  passengerIndex={index}
                />
              ))}
            </div>

            <div className={cn("flex flex-wrap gap-3", isRtl && "flex-row-reverse")}>
              <Button asChild variant="outline">
                <Link href="/flight-status" className="gap-2">
                  <Radio className="w-4 h-4" />
                  {copy.complete.trackFlight}
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border border-gold/30 bg-gold/10 p-5 text-sm text-navy/80">
              <p className="font-semibold text-navy mb-2">{copy.complete.important}</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>{copy.complete.arriveEarly}</li>
                <li>{copy.complete.gateClose}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </main>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}
