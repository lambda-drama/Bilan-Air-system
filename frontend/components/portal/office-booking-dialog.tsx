"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  BilanFormDialog,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createBooking, confirmPaymentAndInvoice } from "@/services/airBooking";
import { fetchSeatMap, type SeatMap } from "@/services/flightSchedule";
import { findFlights, fetchAllRoutes, getBookingSearchDefaults } from "@/services/search";
import type { FlightSearchResult } from "@/services/search";
import { useCurrency } from "@/contexts/currency-context";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { toast } from "sonner";

const PASSENGER_TYPE_OPTIONS = [
  { value: "Adult", label: "Adult" },
  { value: "Child", label: "Child" },
  { value: "Infant", label: "Infant" },
];

const SEAT_CLASS_OPTIONS = [
  { value: "Economy", label: "Economy" },
  { value: "Business", label: "Business" },
  { value: "First Class", label: "First Class" },
];

type Step = "flight" | "seats" | "travelers" | "confirm";

type PassengerForm = {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string;
  passenger_type: string;
};

type SeatRow = {
  name: string;
  seat_number: string;
  seat_class: string;
  status: string;
};

const emptyPassenger = (): PassengerForm => ({
  full_name: "",
  id_number: "",
  date_of_birth: "",
  phone_number: "",
  email: "",
  passenger_type: "Adult",
});

interface OfficeBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (pnr: string) => void;
}

export function OfficeBookingDialog({ open, onOpenChange, onSuccess }: OfficeBookingDialogProps) {
  const { formatMoney } = useCurrency();
  const formAlerts = useFormDialogAlerts();

  const [step, setStep] = useState<Step>("flight");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [seatClass, setSeatClass] = useState("Economy");
  const [airportOptions, setAirportOptions] = useState<{ value: string; label: string }[]>([]);

  const [searching, setSearching] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");

  const [selectedFlight, setSelectedFlight] = useState<FlightSearchResult | null>(null);
  const [seatRows, setSeatRows] = useState<SeatRow[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);

  const [payer, setPayer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [passengers, setPassengers] = useState<PassengerForm[]>([emptyPassenger()]);
  const [markPaid, setMarkPaid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdPnr, setCreatedPnr] = useState<string | null>(null);
  const [totalFare, setTotalFare] = useState<number | null>(null);

  const reset = useCallback(() => {
    setStep("flight");
    setFlightResults([]);
    setSearchError("");
    setSelectedFlight(null);
    setSeatRows([]);
    setSelectedSeatIds([]);
    setPayer({ name: "", email: "", phone: "" });
    setPassengers([emptyPassenger()]);
    setMarkPaid(true);
    setCreatedPnr(null);
    setTotalFare(null);
    formAlerts.clearAlerts();
  }, [formAlerts]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }

    Promise.all([fetchAllRoutes(), getBookingSearchDefaults()])
      .then(([routes, defaults]) => {
        const codes = new Map<string, string>();
        for (const r of routes as Array<{
          origin_code?: string;
          origin_city?: string;
          destination_code?: string;
          destination_city?: string;
        }>) {
          if (r.origin_code) codes.set(r.origin_code, r.origin_city || r.origin_code);
          if (r.destination_code) codes.set(r.destination_code, r.destination_city || r.destination_code);
        }
        setAirportOptions(
          [...codes.entries()].map(([value, city]) => ({
            value,
            label: `${city} (${value})`,
          })),
        );
        setOrigin(defaults.origin_iata);
        setDestination(defaults.destination_iata);
        setDepartureDate(defaults.suggested_date);
      })
      .catch(() => {
        setAirportOptions([
          { value: "NBO", label: "Nairobi (NBO)" },
          { value: "MGQ", label: "Mogadishu (MGQ)" },
        ]);
      });
  }, [open, reset]);

  useEffect(() => {
    setPassengers((prev) => {
      const next = Array.from({ length: passengerCount }, (_, i) => prev[i] || emptyPassenger());
      return next;
    });
  }, [passengerCount]);

  const searchFlights = async () => {
    if (!origin || !destination || !departureDate) {
      formAlerts.showValidation(["Origin", "Destination", "Departure date"]);
      return;
    }
    formAlerts.clearAlerts();
    setSearching(true);
    setSearchError("");
    try {
      const res = await findFlights(origin, destination, departureDate, passengerCount);
      if (res.error) {
        setSearchError(res.error);
        setFlightResults([]);
        return;
      }
      setFlightResults(res.flights || []);
      if (!res.flights?.length) {
        setSearchError("No flights on this route and date.");
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
      setFlightResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickFlight = async (flight: FlightSearchResult) => {
    setSelectedFlight(flight);
    setSeatsLoading(true);
    setSelectedSeatIds([]);
    try {
      const map: SeatMap = await fetchSeatMap(flight.schedule_id);
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
      setSeatRows(flat);
      setStep("seats");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Could not load seats");
    } finally {
      setSeatsLoading(false);
    }
  };

  const visibleSeats = seatRows.filter(
    (s) => s.seat_class === seatClass || seatClass === "Economy",
  );

  const seatsByRow = useMemo(() => {
    const grouped: Record<number, SeatRow[]> = {};
    visibleSeats.forEach((seat) => {
      const row = parseInt(seat.seat_number, 10) || 0;
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
    });
    return grouped;
  }, [visibleSeats]);

  const toggleSeat = (seatId: string) => {
    const seat = seatRows.find((s) => s.name === seatId);
    if (!seat || seat.status !== "Available") return;
    if (selectedSeatIds.includes(seatId)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seatId));
    } else if (selectedSeatIds.length < passengerCount) {
      setSelectedSeatIds([...selectedSeatIds, seatId]);
    }
  };

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const validateTravelers = (): string[] => {
    const missing: string[] = [];
    if (!payer.name.trim()) missing.push("Payer name");
    if (!payer.phone.trim()) missing.push("Payer phone");
    if (!payer.email.trim()) missing.push("Payer email");
    passengers.forEach((p, i) => {
      const n = i + 1;
      if (!p.full_name.trim()) missing.push(`Traveler ${n} name`);
      if (!p.id_number.trim()) missing.push(`Traveler ${n} ID`);
      if (!p.date_of_birth) missing.push(`Traveler ${n} date of birth`);
    });
    return missing;
  };

  const submitBooking = async () => {
    const missing = validateTravelers();
    if (missing.length) {
      formAlerts.showValidation(missing);
      return;
    }
    if (!selectedFlight) return;

    formAlerts.clearAlerts();
    setSubmitting(true);
    try {
      const result = await createBooking({
        flight_schedule: selectedFlight.schedule_id,
        payer_name: payer.name.trim(),
        payer_email: payer.email.trim(),
        payer_phone: payer.phone.trim(),
        passengers: passengers.map((p, i) => ({
          passenger_name: p.full_name.trim(),
          id_number: p.id_number.trim(),
          date_of_birth: p.date_of_birth,
          phone_number: p.phone_number.trim() || payer.phone.trim(),
          email: p.email.trim() || payer.email.trim(),
          passenger_type: p.passenger_type,
          seat_number: selectedSeatIds[i],
          register_profile: true,
        })),
      });

      setCreatedPnr(result.pnr);
      setTotalFare(result.total_fare);

      if (markPaid) {
        await confirmPaymentAndInvoice(result.pnr);
        toast.success(`Booking ${result.pnr} created and paid`);
      } else {
        toast.success(`Booking ${result.pnr} created (payment pending)`);
      }

      onSuccess?.(result.pnr);
      setStep("confirm");
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle =
    step === "flight"
      ? "Office booking — find flight"
      : step === "seats"
        ? "Office booking — select seats"
        : step === "travelers"
          ? "Office booking — traveler details"
          : "Office booking — complete";

  const stepDescription =
    step === "flight"
      ? "Customer at your desk. Search an available flight, then continue."
      : step === "seats"
        ? `Flight ${selectedFlight?.flight_number} · select ${passengerCount} seat(s)`
        : step === "travelers"
          ? "Enter payer and traveler information from the visit."
          : createdPnr
            ? `PNR ${createdPnr}`
            : undefined;

  const footer = (() => {
    if (step === "confirm" && createdPnr) {
      return (
        <Button className="bg-gold text-navy hover:bg-gold-dark" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      );
    }
    if (step === "flight") {
      return (
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            onClick={searchFlights}
            disabled={searching}
          >
            {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Search flights
          </Button>
        </>
      );
    }
    if (step === "seats") {
      return (
        <>
          <Button variant="outline" onClick={() => setStep("flight")}>
            Back
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={selectedSeatIds.length !== passengerCount || seatsLoading}
            onClick={() => setStep("travelers")}
          >
            Continue
          </Button>
        </>
      );
    }
    if (step === "travelers") {
      return (
        <>
          <Button variant="outline" onClick={() => setStep("seats")}>
            Back
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={submitting}
            onClick={submitBooking}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create booking
          </Button>
        </>
      );
    }
    return null;
  })();

  return (
    <BilanFormDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      title={stepTitle}
      description={stepDescription}
      validationErrors={formAlerts.validationErrors}
      submitError={formAlerts.submitError}
      onDismissAlerts={formAlerts.clearAlerts}
      footer={footer}
    >
      {step === "flight" && (
        <>
          <FormGrid>
            <FormField label="From" required>
              <SearchableSelect
                options={airportOptions}
                value={origin}
                onValueChange={setOrigin}
                placeholder="Origin airport..."
                clearable={false}
              />
            </FormField>
            <FormField label="To" required>
              <SearchableSelect
                options={airportOptions}
                value={destination}
                onValueChange={setDestination}
                placeholder="Destination airport..."
                clearable={false}
              />
            </FormField>
            <FormField label="Departure date" required>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              />
            </FormField>
            <FormField label="Travelers" required>
              <Input
                type="number"
                min={1}
                max={9}
                value={passengerCount}
                onChange={(e) => setPassengerCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </FormField>
            <FormField label="Cabin" required fullWidth>
              <SearchableSelect
                options={SEAT_CLASS_OPTIONS}
                value={seatClass}
                onValueChange={setSeatClass}
                clearable={false}
              />
            </FormField>
          </FormGrid>

          {searchError && <p className="mt-4 text-sm text-destructive">{searchError}</p>}

          {flightResults.length > 0 && (
            <FormSection title="Available flights" className="mt-4">
              <div className="space-y-2">
                {flightResults.map((f) => (
                  <button
                    key={f.schedule_id}
                    type="button"
                    onClick={() => pickFlight(f)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-gold hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{f.flight_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {f.departure_time} → {f.arrival_time} · {f.available_seats} seats
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gold">
                      {formatMoney(f.prices?.[seatClass] ?? f.prices?.Economy)}
                    </span>
                  </button>
                ))}
              </div>
            </FormSection>
          )}
        </>
      )}

      {step === "seats" && (
        <>
          {seatsLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading seat map...</p>
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
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Selected {selectedSeatIds.length} of {passengerCount}
              </p>
            </div>
          )}
        </>
      )}

      {step === "travelers" && (
        <>
          <FormSection title="Payer (customer at desk)">
            <FormGrid>
              <FormField label="Full name" required fullWidth>
                <Input
                  value={payer.name}
                  onChange={(e) => setPayer({ ...payer, name: e.target.value })}
                />
              </FormField>
              <FormField label="Phone" required>
                <Input
                  value={payer.phone}
                  onChange={(e) => setPayer({ ...payer, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Email" required>
                <Input
                  type="email"
                  value={payer.email}
                  onChange={(e) => setPayer({ ...payer, email: e.target.value })}
                />
              </FormField>
            </FormGrid>
          </FormSection>

          {passengers.map((p, index) => (
            <FormSection key={index} title={`Traveler ${index + 1}`} className="mt-4">
              <FormGrid>
                <FormField label="Full name" required fullWidth>
                  <Input
                    value={p.full_name}
                    onChange={(e) => updatePassenger(index, "full_name", e.target.value)}
                  />
                </FormField>
                <FormField label="Type" required>
                  <SearchableSelect
                    options={PASSENGER_TYPE_OPTIONS}
                    value={p.passenger_type}
                    onValueChange={(v) => updatePassenger(index, "passenger_type", v)}
                    clearable={false}
                  />
                </FormField>
                <FormField label="ID number" required>
                  <Input
                    value={p.id_number}
                    onChange={(e) => updatePassenger(index, "id_number", e.target.value)}
                  />
                </FormField>
                <FormField label="Date of birth" required>
                  <Input
                    type="date"
                    value={p.date_of_birth}
                    onChange={(e) => updatePassenger(index, "date_of_birth", e.target.value)}
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={p.phone_number}
                    onChange={(e) => updatePassenger(index, "phone_number", e.target.value)}
                  />
                </FormField>
                <FormField label="Email">
                  <Input
                    type="email"
                    value={p.email}
                    onChange={(e) => updatePassenger(index, "email", e.target.value)}
                  />
                </FormField>
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
            <Switch checked={markPaid} onCheckedChange={setMarkPaid} />
          </div>
        </>
      )}

      {step === "confirm" && createdPnr && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">PNR:</span>{" "}
            <span className="font-semibold">{createdPnr}</span>
          </p>
          {totalFare != null && (
            <p>
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-semibold">{formatMoney(totalFare)}</span>
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Payment:</span>{" "}
            {markPaid ? "Paid — invoice created" : "Pending"}
          </p>
        </div>
      )}
    </BilanFormDialog>
  );
}
