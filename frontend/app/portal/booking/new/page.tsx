"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BookingFlowLayout } from "@/components/portal/office-booking/booking-flow-layout";
import { FormAlerts } from "@/components/portal/form-alerts";
import { FormField, FormGrid, FormSection } from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/contexts/currency-context";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import {
  draftFromFlight,
  loadOfficeBookingDraft,
  saveOfficeBookingDraft,
} from "@/lib/office-booking-store";
import { formatAirportDisplay, formatRouteDisplay } from "@/lib/format-airport";
import {
  findFlights,
  fetchAllRoutes,
  getBookingSearchDefaults,
  type AvailableRoute,
  type FlightSearchResult,
} from "@/services/search";

const SEAT_CLASS_OPTIONS = [
  { value: "Economy", label: "Economy" },
  { value: "Business", label: "Business" },
  { value: "First Class", label: "First Class" },
];

type SearchMode = "route" | "airports";

function OfficeBookingSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const { validationErrors, submitError, clearAlerts, showValidation } = useFormDialogAlerts();

  const [searchMode, setSearchMode] = useState<SearchMode>("route");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [routeList, setRouteList] = useState<AvailableRoute[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [seatClass, setSeatClass] = useState("Economy");
  const [airportOptions, setAirportOptions] = useState<{ value: string; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  useEffect(() => {
    const schedule = searchParams.get("schedule");
    if (schedule) {
      router.replace(`/portal/booking/new/seats?schedule=${encodeURIComponent(schedule)}`);
      return;
    }

    let cancelled = false;
    Promise.all([fetchAllRoutes(), getBookingSearchDefaults()])
      .then(([routes, defaults]) => {
        if (cancelled) return;
        const codes = new Map<string, string>();
        for (const r of routes) {
          if (r.origin_code) codes.set(r.origin_code, r.origin_city || r.origin_code);
          if (r.destination_code)
            codes.set(r.destination_code, r.destination_city || r.destination_code);
        }
        setRouteList(routes);
        setAirportOptions(
          [...codes.entries()].map(([value, city]) => ({
            value,
            label: formatAirportDisplay({ city, iata: value }),
          })),
        );
        let nextOrigin = defaults.origin_iata;
        let nextDestination = defaults.destination_iata;
        let nextDate = defaults.suggested_date;
        let nextRoute = defaults.route || "";
        let nextMode: SearchMode = "route";
        let nextPassengers = 1;
        let nextSeatClass = "Economy";

        const draft = loadOfficeBookingDraft();
        if (draft?.scheduleId) setActiveScheduleId(draft.scheduleId);
        if (draft) {
          if (draft.seatClass) nextSeatClass = draft.seatClass;
          if (draft.passengerCount) nextPassengers = draft.passengerCount;
          if (draft.departureDate) nextDate = draft.departureDate;
          if (draft.route) {
            nextRoute = draft.route;
            nextMode = "route";
            const matched = routes.find((r) => r.name === draft.route);
            if (matched?.origin_code) nextOrigin = matched.origin_code;
            if (matched?.destination_code) nextDestination = matched.destination_code;
          } else if (draft.origin && draft.destination) {
            nextOrigin = draft.origin;
            nextDestination = draft.destination;
            nextMode = "airports";
            nextRoute = "";
          }
        }

        setSeatClass(nextSeatClass);
        setPassengerCount(nextPassengers);
        setOrigin(nextOrigin);
        setDestination(nextDestination);
        setDepartureDate(nextDate);
        setSelectedRoute(nextRoute);
        setSearchMode(nextMode);

        if (
          draft &&
          nextDate &&
          (nextRoute || (nextOrigin && nextDestination))
        ) {
          void runFlightSearch({
            mode: nextMode,
            route: nextRoute,
            origin: nextOrigin,
            destination: nextDestination,
            date: nextDate,
            passengers: nextPassengers,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchError("Could not load routes and airports.");
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const routeOptions = useMemo(
    () =>
      routeList.map((r) => ({
        value: r.name,
        label:
          r.route_name ||
          formatRouteDisplay(
            { city: r.origin_city, iata: r.origin_code },
            { city: r.destination_city, iata: r.destination_code },
          ),
      })),
    [routeList],
  );

  const applyRouteAirports = (routeName: string) => {
    const r = routeList.find((x) => x.name === routeName);
    if (!r) return;
    if (r.origin_code) setOrigin(r.origin_code);
    if (r.destination_code) setDestination(r.destination_code);
  };

  const runFlightSearch = async (opts: {
    mode: SearchMode;
    route: string;
    origin: string;
    destination: string;
    date: string;
    passengers: number;
  }) => {
    if (!opts.date) {
      showValidation(["Departure date"]);
      return;
    }
    if (opts.mode === "route" && !opts.route) {
      showValidation(["Route"]);
      return;
    }
    if (opts.mode === "airports" && (!opts.origin || !opts.destination)) {
      showValidation(["From", "To"]);
      return;
    }
    clearAlerts();
    setSearching(true);
    setSearchError("");
    try {
      const res =
        opts.mode === "route"
          ? await findFlights({
              route: opts.route,
              date: opts.date,
              passengers: opts.passengers,
            })
          : await findFlights({
              origin: opts.origin,
              destination: opts.destination,
              date: opts.date,
              passengers: opts.passengers,
            });
      if (res.error) {
        setSearchError(res.error);
        setFlightResults([]);
        return;
      }
      setFlightResults(res.flights || []);
      if (!res.flights?.length) setSearchError("No flights on this route and date.");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
      setFlightResults([]);
    } finally {
      setSearching(false);
    }
  };

  const searchFlights = () =>
    runFlightSearch({
      mode: searchMode,
      route: selectedRoute,
      origin,
      destination,
      date: departureDate,
      passengers: passengerCount,
    });

  const selectFlight = (flight: FlightSearchResult) => {
    const existing = loadOfficeBookingDraft();
    const keepSeats =
      existing?.scheduleId === flight.schedule_id &&
      existing.seatClass === seatClass
        ? existing.selectedSeatIds
        : [];

    saveOfficeBookingDraft({
      ...draftFromFlight(flight, {
        seatClass,
        passengerCount,
        origin,
        destination,
        departureDate,
        route: searchMode === "route" ? selectedRoute : flight.route,
      }),
      selectedSeatIds: keepSeats,
      payer: existing?.payer,
      passengers: existing?.passengers,
      markPaid: existing?.markPaid,
    });
    setActiveScheduleId(flight.schedule_id);
    router.push(`/portal/booking/new/seats?schedule=${encodeURIComponent(flight.schedule_id)}`);
  };

  if (initializing) {
    return (
      <BookingFlowLayout title="Office booking" description="Loading...">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing search...
        </p>
      </BookingFlowLayout>
    );
  }

  return (
    <BookingFlowLayout
      title="Office booking"
      description="Customer at your desk. Search by route or airports, then choose a flight."
    >
      <FormAlerts
        validationErrors={validationErrors}
        submitError={submitError}
        onDismiss={clearAlerts}
        className="mb-4"
      />

      <Tabs
        value={searchMode}
        onValueChange={(v) => setSearchMode(v as SearchMode)}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="route">By route</TabsTrigger>
          <TabsTrigger value="airports">By airports</TabsTrigger>
        </TabsList>
        <p className="mt-2 text-xs text-muted-foreground">
          Flight schedules are tied to a route (origin → destination airports).
        </p>
        <TabsContent value="route" className="mt-4">
          <FormField label="Route" required fullWidth>
            <SearchableSelect
              options={routeOptions}
              value={selectedRoute}
              onValueChange={(v) => {
                setSelectedRoute(v);
                applyRouteAirports(v);
              }}
              placeholder="Select flight route..."
              clearable={false}
            />
          </FormField>
          {selectedRoute && origin && destination && (
            <p className="mt-2 text-xs text-muted-foreground">
              {origin} → {destination}
            </p>
          )}
        </TabsContent>
        <TabsContent value="airports" className="mt-4">
          <FormGrid>
            <FormField label="From" required>
              <SearchableSelect
                options={airportOptions}
                value={origin}
                onValueChange={(v) => {
                  setOrigin(v);
                  setSelectedRoute("");
                }}
                placeholder="Origin airport..."
                clearable={false}
              />
            </FormField>
            <FormField label="To" required>
              <SearchableSelect
                options={airportOptions}
                value={destination}
                onValueChange={(v) => {
                  setDestination(v);
                  setSelectedRoute("");
                }}
                placeholder="Destination airport..."
                clearable={false}
              />
            </FormField>
          </FormGrid>
        </TabsContent>
      </Tabs>

      <FormGrid>
        <FormField label="Departure date" required>
          <Input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </FormField>
            <FormField
              label="Passengers (search)"
              hint="Used to find flights with enough seats. Add more travelers on the next steps."
            >
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
        <FormSection title="Available flights" className="mt-6">
          <div className="space-y-2">
            {flightResults.map((f) => (
              <button
                key={f.schedule_id}
                type="button"
                onClick={() => selectFlight(f)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-gold hover:bg-muted/50 ${
                  activeScheduleId === f.schedule_id ? "border-gold bg-gold/10" : ""
                }`}
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

      <div className="mt-8 flex justify-end gap-3 border-t pt-6">
        <Button variant="outline" asChild>
          <Link href="/portal/bookings">Cancel</Link>
        </Button>
        <Button
          className="bg-gold text-navy hover:bg-gold-dark"
          onClick={searchFlights}
          disabled={searching}
        >
          {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Search flights
        </Button>
      </div>
    </BookingFlowLayout>
  );
}

export default function OfficeBookingSearchPage() {
  return (
    <Suspense
      fallback={
        <BookingFlowLayout title="Office booking">
          <p className="text-muted-foreground">Loading...</p>
        </BookingFlowLayout>
      }
    >
      <OfficeBookingSearchContent />
    </Suspense>
  );
}
