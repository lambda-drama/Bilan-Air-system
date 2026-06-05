"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BookingFlowLayout } from "@/components/portal/office-booking/booking-flow-layout";
import { FormAlerts } from "@/components/portal/form-alerts";
import { Button } from "@/components/ui/button";
import {
  draftFromFlight,
  loadOfficeBookingDraft,
  saveOfficeBookingDraft,
} from "@/lib/office-booking-store";
import { ensureScheduleSeats, fetchSeatMap } from "@/services/flightSchedule";
import { getScheduleForOfficeBooking } from "@/services/search";

const MAX_TRAVELERS = 9;

type SeatRow = {
  name: string;
  seat_number: string;
  seat_class: string;
  status: string;
};

function SeatsStepContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(loadOfficeBookingDraft());
  const [seatRows, setSeatRows] = useState<SeatRow[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const scheduleFromUrl = searchParams.get("schedule");
  const seatClass = draft?.seatClass ?? "Economy";
  const minSeatsRequired = Math.max(
    draft?.passengerCount ?? 1,
    draft?.passengers?.length ?? 0,
    1,
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError("");

      let current = loadOfficeBookingDraft();
      const scheduleId = scheduleFromUrl || current?.scheduleId;

      if (!scheduleId) {
        router.replace("/portal/booking/new");
        return;
      }

      if (!current?.scheduleId || current.scheduleId !== scheduleId) {
        const ctx = await getScheduleForOfficeBooking(
          scheduleId,
          parseInt(searchParams.get("passengers") || "1", 10) || 1,
        );
        if (cancelled) return;
        if (ctx.error || !ctx.flight) {
          setError(ctx.error || "Cannot book this flight");
          setLoading(false);
          return;
        }
        current = draftFromFlight(ctx.flight, {
          seatClass: "Economy",
          passengerCount: parseInt(searchParams.get("passengers") || "1", 10) || 1,
          origin: ctx.origin_iata,
          destination: ctx.destination_iata,
          departureDate: ctx.date,
          route: ctx.route,
        });
        saveOfficeBookingDraft(current);
      }

      if (cancelled) return;
      setDraft(current);
      setScheduleId(scheduleId);

      try {
        const flat = await loadSeatRows(scheduleId);
        if (cancelled) return;
        setSeatRows(flat);
        const classForSeats = current.seatClass ?? "Economy";
        const savedSeatIds = (current.selectedSeatIds || []).filter((id) => {
          const seat = flat.find((s) => s.name === id);
          return seat && seat.seat_class === classForSeats;
        });
        setSelectedSeatIds(savedSeatIds);
        if (!flat.length) {
          setError(
            "No seats on this flight. Generate seats from the airplane layout, or pick another schedule.",
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load seats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router, scheduleFromUrl, searchParams]);

  const visibleSeats = seatRows.filter((s) => s.seat_class === seatClass);

  const seatsByRow = useMemo(() => {
    const grouped: Record<number, SeatRow[]> = {};
    visibleSeats.forEach((seat) => {
      const row = parseInt(seat.seat_number, 10) || 0;
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
    });
    return grouped;
  }, [visibleSeats]);

  async function loadSeatRows(flightScheduleId: string) {
    const map = await fetchSeatMap(flightScheduleId);
    const flat: SeatRow[] = [];
    for (const [cls, list] of Object.entries(map)) {
      for (const s of list) {
        flat.push({
          name: s.name,
          seat_number: s.seat_number,
          seat_class: cls,
          status: s.status,
        });
      }
    }
    return flat;
  }

  const generateSeats = async () => {
    if (!scheduleId) return;
    setGenerating(true);
    setError("");
    try {
      const res = await ensureScheduleSeats(scheduleId);
      const flat = await loadSeatRows(scheduleId);
      setSeatRows(flat);
      if (flat.length) {
        setError("");
      } else {
        setError(
          "Still no seats. Open the Airplane record in Desk and add seat configuration (rows and columns per cabin), then try again.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate seats");
    } finally {
      setGenerating(false);
    }
  };

  const toggleSeat = (seatId: string) => {
    const seat = seatRows.find((s) => s.name === seatId);
    if (!seat || seat.status !== "Available" || seat.seat_class !== seatClass) return;
    if (selectedSeatIds.includes(seatId)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seatId));
    } else if (selectedSeatIds.length < MAX_TRAVELERS) {
      setSelectedSeatIds([...selectedSeatIds, seatId]);
    }
  };

  const continueToTravelers = () => {
    if (!draft) return;
    saveOfficeBookingDraft({
      ...draft,
      selectedSeatIds,
      passengerCount: selectedSeatIds.length,
    });
    router.push(
      `/portal/booking/new/travelers?schedule=${encodeURIComponent(draft.scheduleId)}`,
    );
  };

  const canContinue =
    !loading &&
    selectedSeatIds.length >= 1 &&
    selectedSeatIds.length >= minSeatsRequired;

  return (
    <BookingFlowLayout
      title="Select seats"
      description={
        draft
          ? `Flight ${draft.flightNumber} · ${seatClass} cabin · select one seat per traveler (up to ${MAX_TRAVELERS})`
          : undefined
      }
    >
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-4 sm:-mx-6 sm:px-6">
        <Button variant="outline" onClick={() => router.push("/portal/booking/new")}>
          Back
        </Button>
        <p className="order-last w-full text-center text-sm text-muted-foreground sm:order-0 sm:w-auto">
          {selectedSeatIds.length} seat(s) selected
          {minSeatsRequired > 1 ? ` · need at least ${minSeatsRequired}` : ""}
        </p>
        <Button
          className="bg-gold text-navy hover:bg-gold-dark"
          disabled={!canContinue}
          onClick={continueToTravelers}
        >
          Next: Travelers
        </Button>
      </div>

      {error && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          {scheduleId && (
            <Button
              type="button"
              variant="outline"
              disabled={generating}
              onClick={generateSeats}
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate seats from airplane
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading seat map...
        </p>
      ) : visibleSeats.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {seatClass} seats on this flight. Go back and choose another cabin or flight.
        </p>
      ) : (
        <div className="space-y-2">
          {Object.keys(seatsByRow)
            .map(Number)
            .sort((a, b) => a - b)
            .map((row) => (
              <div key={row} className="flex items-center justify-center gap-1.5">
                <span className="w-6 text-xs text-muted-foreground">{row}</span>
                {seatsByRow[row]
                  .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
                  .map((seat) => {
                    const selected = selectedSeatIds.includes(seat.name);
                    const available = seat.status === "Available";
                    return (
                      <button
                        key={seat.name}
                        type="button"
                        disabled={!available}
                        onClick={() => toggleSeat(seat.name)}
                        className={`h-8 w-8 rounded text-xs font-medium ${
                          !available
                            ? "cursor-not-allowed bg-muted text-muted-foreground"
                            : selected
                              ? "bg-gold text-navy"
                              : "border bg-background hover:border-gold"
                        }`}
                      >
                        {seat.seat_number.replace(/^\d+/, "") || seat.seat_number}
                      </button>
                    );
                  })}
              </div>
            ))}
        </div>
      )}
    </BookingFlowLayout>
  );
}

export default function OfficeBookingSeatsPage() {
  return (
    <Suspense
      fallback={
        <BookingFlowLayout title="Select seats">
          <p className="text-muted-foreground">Loading...</p>
        </BookingFlowLayout>
      }
    >
      <SeatsStepContent />
    </Suspense>
  );
}
