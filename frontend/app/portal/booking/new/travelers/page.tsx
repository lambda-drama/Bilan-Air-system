"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { BookingFlowLayout } from "@/components/portal/office-booking/booking-flow-layout";
import { FormAlerts } from "@/components/portal/form-alerts";
import { FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBookingSettings } from "@/hooks/use-booking-settings";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { officeBookingAfterFlightPath } from "@/lib/booking-seat-step";
import {
  loadOfficeBookingDraft,
  saveOfficeBookingDraft,
  type OfficeBookingPassengerDraft,
} from "@/lib/office-booking-store";
import { PayerIsTravelingToggle } from "@/components/booking/payer-is-traveling-toggle";
import {
  applyPayerToFirstTraveler,
  travelerMatchesPayer,
} from "@/lib/payer-traveler-sync";
import { bookingLookupRef, createBooking, confirmPaymentAndInvoice } from "@/services/airBooking";
import { toast } from "sonner";

const MAX_TRAVELERS = 9;

const PASSENGER_TYPE_OPTIONS = [
  { value: "Adult", label: "Adult" },
  { value: "Child", label: "Child (2–11 years)" },
  { value: "Infant", label: "Infant (under 2 years)" },
];

const emptyPassenger = (): OfficeBookingPassengerDraft => ({
  full_name: "",
  id_number: "",
  date_of_birth: "",
  phone_number: "",
  email: "",
  passenger_type: "Adult",
});

function passengerTypeLabel(type: string) {
  return PASSENGER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export default function OfficeBookingTravelersPage() {
  const router = useRouter();
  const { enableSeatSelection, loading: settingsLoading } = useBookingSettings();
  const { validationErrors, submitError, clearAlerts, showValidation, setSubmitError } =
    useFormDialogAlerts();

  const [draft, setDraft] = useState(loadOfficeBookingDraft());
  const [payer, setPayer] = useState({ name: "", email: "", phone: "" });
  const [passengers, setPassengers] = useState<OfficeBookingPassengerDraft[]>([emptyPassenger()]);
  const [markPaid, setMarkPaid] = useState(true);
  const [payerIsTraveling, setPayerIsTraveling] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const seatCount = draft?.selectedSeatIds?.length ?? 0;
  const needsMoreSeats = enableSeatSelection && passengers.length > seatCount;

  useEffect(() => {
    if (settingsLoading) return;
    const d = loadOfficeBookingDraft();
    if (!d?.scheduleId) {
      router.replace("/portal/booking/new");
      return;
    }
    if (enableSeatSelection && !d.selectedSeatIds?.length) {
      router.replace(
        officeBookingAfterFlightPath(d.scheduleId, true),
      );
      return;
    }
    setDraft(d);
    setMarkPaid(d.markPaid ?? true);
    const nextPayer = d.payer ?? { name: "", email: "", phone: "" };
    if (d.payer) setPayer(nextPayer);

    const count = enableSeatSelection
      ? Math.max(d.selectedSeatIds?.length ?? 0, d.passengers?.length ?? 0, 1)
      : Math.max(d.passengerCount ?? 1, d.passengers?.length ?? 0, 1);
    let nextPassengers = Array.from(
      { length: count },
      (_, i) => d.passengers?.[i] || emptyPassenger(),
    );
    const traveling =
      d.payerIsTraveling ??
      (count === 1 || travelerMatchesPayer(nextPassengers[0], nextPayer));
    setPayerIsTraveling(traveling);
    if (traveling && nextPayer.name.trim()) {
      nextPassengers = applyPayerToFirstTraveler(nextPassengers, nextPayer);
    }
    setPassengers(nextPassengers);
  }, [router, enableSeatSelection, settingsLoading]);

  const persistDraft = (
    nextPassengers: OfficeBookingPassengerDraft[],
    nextPayer = payer,
    nextMarkPaid = markPaid,
    nextPayerIsTraveling = payerIsTraveling,
  ) => {
    if (!draft) return;
    saveOfficeBookingDraft({
      ...draft,
      payer: nextPayer,
      passengers: nextPassengers,
      passengerCount: nextPassengers.length,
      markPaid: nextMarkPaid,
      payerIsTraveling: nextPayerIsTraveling,
    });
  };

  const setPayerIsTravelingState = (active: boolean) => {
    setPayerIsTraveling(active);
    if (active) {
      const synced = applyPayerToFirstTraveler(passengers, payer);
      setPassengers(synced);
      persistDraft(synced, payer, markPaid, active);
      return;
    }
    persistDraft(passengers, payer, markPaid, active);
  };

  const updatePayer = (next: { name: string; email: string; phone: string }) => {
    setPayer(next);
    if (payerIsTraveling) {
      const synced = applyPayerToFirstTraveler(passengers, next);
      setPassengers(synced);
      persistDraft(synced, next, markPaid, payerIsTraveling);
      return;
    }
    persistDraft(passengers, next, markPaid, payerIsTraveling);
  };

  const updatePassenger = (index: number, field: keyof OfficeBookingPassengerDraft, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      persistDraft(next);
      return next;
    });
  };

  const addTraveler = () => {
    if (passengers.length >= MAX_TRAVELERS) return;
    const next = [...passengers, emptyPassenger()];
    setPassengers(next);
    persistDraft(next);
  };

  const removeTraveler = (index: number) => {
    if (passengers.length <= 1) return;
    const next = passengers.filter((_, i) => i !== index);
    setPassengers(next);
    persistDraft(next);
  };

  const validate = (): string[] => {
    const missing: string[] = [];
    if (!payer.name.trim()) missing.push("Payer name");
    if (!payer.phone.trim()) missing.push("Payer phone");
    if (!payer.email.trim()) missing.push("Payer email");

    if (enableSeatSelection && passengers.length !== seatCount) {
      missing.push(
        `${passengers.length} traveler(s) but ${seatCount} seat(s) — add seats or remove travelers`,
      );
    }

    passengers.forEach((p, i) => {
      const n = i + 1;
      if (!p.full_name.trim()) missing.push(`Traveler ${n} name`);
      if (!p.passenger_type) missing.push(`Traveler ${n} passenger type (Adult / Child / Infant)`);
    });
    return missing;
  };

  const submitBooking = async () => {
    const missing = validate();
    if (missing.length) {
      showValidation(missing);
      return;
    }
    if (!draft) return;

    clearAlerts();
    setSubmitting(true);
    try {
      const result = await createBooking({
        booking_source: "office",
        flight_schedule: draft.scheduleId,
        seat_class: draft.seatClass,
        payer_name: payer.name.trim(),
        payer_email: payer.email.trim(),
        payer_phone: payer.phone.trim(),
        passengers: passengers.map((p, i) => ({
          passenger_name: p.full_name.trim(),
          id_number: p.id_number.trim() || undefined,
          date_of_birth: p.date_of_birth || undefined,
          phone_number: p.phone_number.trim() || payer.phone.trim(),
          email: p.email.trim() || payer.email.trim(),
          passenger_type: p.passenger_type,
          seat_number: enableSeatSelection ? draft.selectedSeatIds[i] : undefined,
          register_profile: false,
        })),
      });

      let displayRef = result.reservation_ref;
      if (markPaid) {
        const paid = await confirmPaymentAndInvoice(bookingLookupRef(result));
        displayRef = (paid.pnr as string) || result.reservation_ref;
        toast.success(`Booking ${displayRef} created and paid`);
      } else {
        toast.success(`Booking ${result.reservation_ref} reserved (payment pending)`);
      }

      saveOfficeBookingDraft({
        ...draft,
        payer,
        passengers,
        passengerCount: passengers.length,
        markPaid,
        payerIsTraveling,
      });

      router.push(
        `/portal/booking/new/done?ref=${encodeURIComponent(displayRef)}&paid=${markPaid ? "1" : "0"}&total=${result.total_fare}`,
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return (
      <BookingFlowLayout title="Traveler details">
        <p className="text-muted-foreground">Loading...</p>
      </BookingFlowLayout>
    );
  }

  return (
    <BookingFlowLayout
      title="Traveler details"
      description={
        enableSeatSelection
          ? `One form per traveler (${passengers.length} traveler${passengers.length === 1 ? "" : "s"}, ${seatCount} seat${seatCount === 1 ? "" : "s"} selected). Only the payer is saved as an ERPNext customer — travelers are not given website logins.`
          : `One form per traveler (${passengers.length} traveler${passengers.length === 1 ? "" : "s"}). Seats can be assigned later at check-in. Only the payer is saved as an ERPNext customer.`
      }
    >
      <FormAlerts
        validationErrors={validationErrors}
        submitError={submitError}
        onDismiss={clearAlerts}
        className="mb-4"
      />

      {enableSeatSelection && needsMoreSeats && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-foreground">
            {passengers.length - seatCount} traveler(s) still need a seat
          </p>
          <p className="mt-1 text-muted-foreground">
            Go back and select {passengers.length} seats on the seat map (one per person).
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/portal/booking/new/seats">Back to select seats</Link>
          </Button>
        </div>
      )}

      <FormSection title="Payer (customer who pays — saved as Customer on invoice)">
        <FormGrid>
          <FormField label="Full name" required fullWidth>
            <Input
              value={payer.name}
              onChange={(e) => updatePayer({ ...payer, name: e.target.value })}
            />
          </FormField>
          <FormField label="Phone" required>
            <Input
              value={payer.phone}
              onChange={(e) => updatePayer({ ...payer, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={payer.email}
              onChange={(e) => updatePayer({ ...payer, email: e.target.value })}
            />
          </FormField>
        </FormGrid>
        <div className="mt-3">
          <PayerIsTravelingToggle
            active={payerIsTraveling}
            onToggle={setPayerIsTravelingState}
            label="Payer is also Traveler 1"
          />
        </div>
      </FormSection>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Travelers on this booking</h3>
          <p className="text-xs text-muted-foreground">
            Mark each person as Adult, Child, or Infant
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={passengers.length >= MAX_TRAVELERS}
          onClick={addTraveler}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add traveler
        </Button>
      </div>

      {passengers.map((p, index) => (
        <FormSection
          key={index}
          title={`Traveler ${index + 1}`}
          className="mt-4 relative"
        >
          {passengers.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 text-destructive hover:text-destructive"
              onClick={() => removeTraveler(index)}
              aria-label={`Remove traveler ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <FormGrid>
            <FormField label="Passenger type" required fullWidth>
              <SearchableSelect
                options={PASSENGER_TYPE_OPTIONS}
                value={p.passenger_type}
                onValueChange={(v) => updatePassenger(index, "passenger_type", v)}
                placeholder="Adult, Child, or Infant..."
                clearable={false}
              />
            </FormField>
            {p.passenger_type && p.passenger_type !== "Adult" && (
              <p className="col-span-full -mt-2 text-xs text-muted-foreground">
                Selected: {passengerTypeLabel(p.passenger_type)}
              </p>
            )}
            {index === 0 && payerIsTraveling ? (
              <p className="col-span-full rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Name, phone, and email are taken from the payer above. Add ID or date of birth
                below if needed.
              </p>
            ) : null}
            {!(index === 0 && payerIsTraveling) && (
              <FormField label="Full name" required fullWidth>
                <Input
                  value={p.full_name}
                  onChange={(e) => updatePassenger(index, "full_name", e.target.value)}
                />
              </FormField>
            )}
            <FormField label="ID number (optional)">
              <Input
                value={p.id_number}
                onChange={(e) => updatePassenger(index, "id_number", e.target.value)}
              />
            </FormField>
            <FormField label="Date of birth (optional)">
              <Input
                type="date"
                value={p.date_of_birth}
                onChange={(e) => updatePassenger(index, "date_of_birth", e.target.value)}
              />
            </FormField>
            {!(index === 0 && payerIsTraveling) && (
              <>
                <FormField label="Phone (optional)">
                  <Input
                    value={p.phone_number}
                    onChange={(e) => updatePassenger(index, "phone_number", e.target.value)}
                  />
                </FormField>
                <FormField label="Email (optional)">
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(e) => updatePassenger(index, "email", e.target.value)}
                  />
                </FormField>
              </>
            )}
          </FormGrid>
        </FormSection>
      ))}

      <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium">Paid at counter</Label>
          <p className="text-xs text-muted-foreground">
            Creates sales invoice and records payment immediately
          </p>
        </div>
        <Switch
          checked={markPaid}
          onCheckedChange={(v) => {
            setMarkPaid(v);
            persistDraft(passengers, payer, v);
          }}
        />
      </div>

      <div className="mt-8 flex justify-between gap-3 border-t pt-6">
        <Button
          variant="outline"
          onClick={() =>
            router.push(
              enableSeatSelection && draft?.scheduleId
                ? `/portal/booking/new/seats?schedule=${encodeURIComponent(draft.scheduleId)}`
                : "/portal/booking/new",
            )
          }
        >
          Back
        </Button>
        <Button
          className="bg-gold text-navy hover:bg-gold-dark"
          disabled={submitting || needsMoreSeats}
          onClick={submitBooking}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create booking
        </Button>
      </div>
    </BookingFlowLayout>
  );
}
