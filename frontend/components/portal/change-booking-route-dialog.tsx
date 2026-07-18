"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/portal/searchable-select";
import {
  changeBookingFlight,
  getBookingJourneyOptions,
  updateBookingJourney,
  type BookingDetails,
} from "@/services/airBooking";
import { listSchedules } from "@/services/flightSchedule";
import { clearPortalPointerLocks } from "@/lib/portal-pointer-lock";
import { toast } from "sonner";

type Props = {
  open: boolean;
  bookingRef: string | null;
  detail: BookingDetails | null;
  mode: "journey" | "flight";
  onOpenChange: (open: boolean) => void;
  onSuccess: (detail: BookingDetails) => void;
};

export function ChangeBookingRouteDialog({
  open,
  bookingRef,
  detail,
  mode,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [airports, setAirports] = useState<Array<{ value: string; label: string }>>([]);
  const [boarding, setBoarding] = useState("");
  const [deboarding, setDeboarding] = useState("");
  const [schedules, setSchedules] = useState<Array<{ value: string; label: string }>>([]);
  const [newSchedule, setNewSchedule] = useState("");

  useEffect(() => {
    if (!open || !bookingRef) {
      setError("");
      setAirports([]);
      setBoarding("");
      setDeboarding("");
      setSchedules([]);
      setNewSchedule("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const load = async () => {
      try {
        if (mode === "journey") {
          const opts = await getBookingJourneyOptions(bookingRef);
          if (cancelled) return;
          setAirports(opts.airports || []);
          setBoarding(opts.boarding_airport || "");
          setDeboarding(opts.deboarding_airport || "");
        } else {
          const res = await listSchedules({ limit: 200, upcoming: true });
          if (cancelled) return;
          const current = detail?.flight_schedule || detail?.flight?.schedule_id;
          setSchedules(
            (res.data || [])
              .filter((s) => s.name !== current)
              .map((s) => ({
                value: s.name,
                label: `${s.flight_number} · ${s.route_label || s.route} · ${s.departure_date}`,
              })),
          );
          setNewSchedule("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load options");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, bookingRef, mode, detail?.flight_schedule, detail?.flight?.schedule_id]);

  const handleSubmit = async () => {
    if (!bookingRef) return;
    setSubmitting(true);
    setError("");
    try {
      if (mode === "journey") {
        if (!boarding || !deboarding) {
          setError("Select boarding and deboarding airports.");
          return;
        }
        const res = await updateBookingJourney({
          pnr: bookingRef,
          boarding_airport: boarding,
          deboarding_airport: deboarding,
        });
        if (res.seat_warnings?.length) {
          toast.warning(res.seat_warnings.join(" · "));
        }
        toast.success("Boarding points updated");
        onSuccess(res.booking);
        onOpenChange(false);
      } else {
        if (!newSchedule) {
          setError("Select a new flight schedule.");
          return;
        }
        const res = await changeBookingFlight({
          pnr: bookingRef,
          flight_schedule: newSchedule,
        });
        toast.success(
          `Moved to ${res.flight_number || newSchedule}. Seats were cleared — reassign if needed.`,
        );
        onSuccess(res.booking);
        onOpenChange(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearPortalPointerLocks();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "journey" ? "Change boarding points" : "Change flight / route"}
          </DialogTitle>
          <DialogDescription>
            {mode === "journey"
              ? "Update where the passenger boards and leaves on this flight (partial journey)."
              : "Move this booking to another published flight. Assigned seats will be cleared."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : mode === "journey" ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Boarding airport</Label>
              <SearchableSelect
                options={airports}
                value={boarding}
                onValueChange={setBoarding}
                placeholder="Select boarding…"
                clearable={false}
              />
            </div>
            <div className="space-y-2">
              <Label>Deboarding airport</Label>
              <SearchableSelect
                options={airports}
                value={deboarding}
                onValueChange={setDeboarding}
                placeholder="Select deboarding…"
                clearable={false}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New flight schedule</Label>
              <SearchableSelect
                options={schedules}
                value={newSchedule}
                onValueChange={setNewSchedule}
                placeholder="Search flight…"
                clearable={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {detail?.flight.flight_number} ·{" "}
              {detail?.boarding_label || detail?.flight.origin_label || detail?.flight.origin} →{" "}
              {detail?.deboarding_label ||
                detail?.flight.destination_label ||
                detail?.flight.destination}
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={submitting || loading}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
