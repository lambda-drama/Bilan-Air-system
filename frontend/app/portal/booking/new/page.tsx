"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { formatAirportDisplay, formatRouteDisplay, buildIataLabelMapFromRoutes } from "@/lib/format-airport";
import { officeBookingAfterFlightPath } from "@/lib/booking-seat-step";
import { FlightSearchPassengersCabin } from "@/components/flight-search-passengers-cabin";
import { NearestFlightDatesPanel } from "@/components/nearest-flight-dates-panel";
import { cabinOptionsFromApi } from "@/lib/cabin-classes";
import {
  DEFAULT_PASSENGER_COUNTS,
  normalizePassengerCounts,
  seatsRequired,
  totalPassengers,
  SEAT_CLASS_OPTIONS,
  type PassengerSearchCounts,
  type SeatClassOption,
} from "@/lib/passenger-search-counts";
import {
  findFlights,
  fetchAllRoutes,
  fetchPublicSeatClasses,
  fetchPublicCabinClasses,
  getBookingSearchDefaults,
  suggestNearestFlightDates,
  type AvailableRoute,
  type FlightSearchResult,
  type NearestFlightDateSuggestion,
  type PublicSeatClassOption,
} from "@/services/search";
import {
  FlightFareResultCard,
  defaultFareCardLabels,
  flightSearchResultToFareDisplay,
} from "@/components/flight-fare-result-card";

type SearchMode = "route" | "airports";

function canRunOfficeFlightSearch(opts: {
  mode: SearchMode;
  route: string;
  origin: string;
  destination: string;
  date: string;
}) {
  if (!opts.date) return false;
  if (opts.mode === "route") return !!opts.route;
  return !!(opts.origin && opts.destination);
}

function OfficeBookingSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const { validationErrors, submitError, clearAlerts, showValidation } = useFormDialogAlerts();
  const searchGeneration = useRef(0);

  const [searchMode, setSearchMode] = useState<SearchMode>("route");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [routeList, setRouteList] = useState<AvailableRoute[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengerCounts, setPassengerCounts] = useState<PassengerSearchCounts>({
    ...DEFAULT_PASSENGER_COUNTS,
  });
  const [seatClass, setSeatClass] = useState<SeatClassOption>("Economy");
  const [airportOptions, setAirportOptions] = useState<{ value: string; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [departureSuggestions, setDepartureSuggestions] = useState<NearestFlightDateSuggestion[]>([]);
  const [loadingDepartureSuggestions, setLoadingDepartureSuggestions] = useState(false);
  const [departureSuggestionsChecked, setDepartureSuggestionsChecked] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [activeSeatClass, setActiveSeatClass] = useState<string | null>(null);
  const [enableSeatSelection, setEnableSeatSelection] = useState(false);
  const [seatClasses, setSeatClasses] = useState<PublicSeatClassOption[]>([]);
  const [cabinOptions, setCabinOptions] = useState(SEAT_CLASS_OPTIONS);

  useEffect(() => {
    const schedule = searchParams.get("schedule");
    if (schedule) {
      getBookingSearchDefaults()
        .then((defaults) => {
          router.replace(
            officeBookingAfterFlightPath(schedule, !!defaults.enable_seat_selection),
          );
        })
        .catch(() => {
          router.replace(officeBookingAfterFlightPath(schedule, false));
        });
      return;
    }

    let cancelled = false;
    Promise.all([
      fetchAllRoutes(),
      getBookingSearchDefaults(),
      fetchPublicSeatClasses(),
      fetchPublicCabinClasses(),
    ])
      .then(([routes, defaults, classes, cabins]) => {
        if (cancelled) return;
        setSeatClasses(classes);
        setCabinOptions(cabinOptionsFromApi(cabins));
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
        let nextPassengers = DEFAULT_PASSENGER_COUNTS;
        let nextSeatClass: SeatClassOption = "Economy";

        const draft = loadOfficeBookingDraft();
        if (draft?.scheduleId) setActiveScheduleId(draft.scheduleId);
        if (draft) {
          if (draft.seatClass) nextSeatClass = draft.seatClass as SeatClassOption;
          if (draft.passengerCounts) {
            nextPassengers = normalizePassengerCounts(draft.passengerCounts);
          } else if (draft.passengerCount) {
            nextPassengers = normalizePassengerCounts({
              adults: draft.passengerCount,
              children: 0,
              infants: 0,
            });
          }
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

        setEnableSeatSelection(!!defaults.enable_seat_selection);
        setSeatClass(nextSeatClass);
        setPassengerCounts(nextPassengers);
        setOrigin(nextOrigin);
        setDestination(nextDestination);
        setDepartureDate(nextDate);
        setSelectedRoute(nextRoute);
        setSearchMode(nextMode);
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

  const iataLabels = useMemo(() => buildIataLabelMapFromRoutes(routeList), [routeList]);

  const applyRouteAirports = (routeName: string) => {
    const r = routeList.find((x) => x.name === routeName);
    if (!r) return;
    if (r.origin_code) setOrigin(r.origin_code);
    if (r.destination_code) setDestination(r.destination_code);
  };

  const loadDepartureSuggestions = async (
    opts: { mode: SearchMode; route: string; origin: string; destination: string },
    anchorDate: string,
    seatNeed: number,
  ) => {
    const legOrigin = opts.mode === "route" ? origin : opts.origin;
    const legDestination = opts.mode === "route" ? destination : opts.destination;
    if (!legOrigin || !legDestination || !anchorDate) return;
    setLoadingDepartureSuggestions(true);
    setDepartureSuggestionsChecked(false);
    setDepartureSuggestions([]);
    try {
      const res = await suggestNearestFlightDates({
        origin: legOrigin,
        destination: legDestination,
        anchor_date: anchorDate,
        passengers: seatNeed,
      });
      setDepartureSuggestions(res.suggestions || []);
    } catch {
      setDepartureSuggestions([]);
    } finally {
      setLoadingDepartureSuggestions(false);
      setDepartureSuggestionsChecked(true);
    }
  };

  const runFlightSearch = async (
    opts: {
      mode: SearchMode;
      route: string;
      origin: string;
      destination: string;
      date: string;
      passengers: PassengerSearchCounts;
    },
    options?: { validate?: boolean },
  ) => {
    const validate = options?.validate ?? true;
    if (!canRunOfficeFlightSearch(opts)) {
      if (validate) {
        if (!opts.date) showValidation(["Departure date"]);
        else if (opts.mode === "route") showValidation(["Route"]);
        else showValidation(["From", "To"]);
      }
      return;
    }
    clearAlerts();
    const gen = ++searchGeneration.current;
    setSearching(true);
    setSearchError("");
    setFlightResults([]);
    setDepartureSuggestions([]);
    setDepartureSuggestionsChecked(false);
    setActiveScheduleId(null);
    setActiveSeatClass(null);
    const seatNeed = seatsRequired(opts.passengers);
    try {
      const res =
        opts.mode === "route"
          ? await findFlights({
              route: opts.route,
              date: opts.date,
              passengers: seatNeed,
            })
          : await findFlights({
              origin: opts.origin,
              destination: opts.destination,
              date: opts.date,
              passengers: seatNeed,
            });
      if (gen !== searchGeneration.current) return;
      if (res.error) {
        setSearchError(res.error);
        setFlightResults([]);
        void loadDepartureSuggestions(opts, opts.date, seatNeed);
        return;
      }
      setFlightResults(res.flights || []);
      if (!res.flights?.length) {
        setSearchError("No flights on this route and date.");
        void loadDepartureSuggestions(opts, opts.date, seatNeed);
      }
    } catch (e) {
      if (gen !== searchGeneration.current) return;
      setSearchError(e instanceof Error ? e.message : "Search failed");
      setFlightResults([]);
    } finally {
      if (gen === searchGeneration.current) setSearching(false);
    }
  };

  const searchFlights = (options?: { validate?: boolean }) =>
    runFlightSearch(
      {
        mode: searchMode,
        route: selectedRoute,
        origin,
        destination,
        date: departureDate,
        passengers: passengerCounts,
      },
      options,
    );

  // Re-search whenever route, airports, date, travelers, or search mode change.
  useEffect(() => {
    if (initializing) return;

    const opts = {
      mode: searchMode,
      route: selectedRoute,
      origin,
      destination,
      date: departureDate,
    };
    if (!canRunOfficeFlightSearch(opts)) {
      setFlightResults([]);
      setSearchError("");
      setDepartureSuggestions([]);
      setDepartureSuggestionsChecked(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void runFlightSearch(
        {
          ...opts,
          passengers: passengerCounts,
        },
        { validate: false },
      );
    }, 350);

    return () => window.clearTimeout(timer);
    // Intentionally omit runFlightSearch — search when these criteria change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initializing,
    searchMode,
    selectedRoute,
    origin,
    destination,
    departureDate,
    passengerCounts.adults,
    passengerCounts.children,
    passengerCounts.infants,
  ]);

  const applyDepartureSuggestion = (suggestedDate: string) => {
    setDepartureDate(suggestedDate);
    setSearchError("");
    setDepartureSuggestions([]);
  };

  const selectFlight = (flight: FlightSearchResult, chosenClass: string) => {
    const cabinClassName =
      seatClasses.find((sc) => sc.class_name === chosenClass)?.cabin_name || seatClass;
    const paxTotal = totalPassengers(passengerCounts);
    const existing = loadOfficeBookingDraft();
    const keepSeats =
      existing?.scheduleId === flight.schedule_id &&
      existing.seatClass === chosenClass
        ? existing.selectedSeatIds
        : [];

    saveOfficeBookingDraft({
      ...draftFromFlight(flight, {
        seatClass: chosenClass,
        cabinClass: cabinClassName,
        passengerCount: paxTotal,
        passengerCounts,
        origin,
        destination,
        departureDate,
        route: searchMode === "route" ? selectedRoute : flight.route,
      }),
      onlyPrepayment: !!flight.only_prepayment,
      selectedSeatIds: keepSeats,
      payer: existing?.payer,
      passengers: existing?.passengers,
      markPaid: existing?.markPaid,
    });
    setActiveScheduleId(flight.schedule_id);
    setActiveSeatClass(chosenClass);
    router.push(officeBookingAfterFlightPath(flight.schedule_id, enableSeatSelection));
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
      </FormGrid>

      <FlightSearchPassengersCabin
        counts={passengerCounts}
        onCountsChange={setPassengerCounts}
        seatClass={seatClass}
        onSeatClassChange={setSeatClass}
        cabinOptions={cabinOptions}
        variant="portal"
        disabled={searching}
        className="mt-4"
        labels={{
          passengers: "Travelers",
          adults: "Adults",
          children: "Children (2–11)",
          infants: "Infants (under 2)",
          infantsHint: "On lap — no separate seat",
          cabin: "Cabin",
        }}
      />

      {searchError ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-destructive">{searchError}</p>
          <NearestFlightDatesPanel
            title="Nearest dates with flights:"
            loadingLabel="Finding nearby dates…"
            emptyLabel="No nearby dates found for this route."
            useDateLabel={(d) =>
              new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            }
            formatDaysOffset={(days) => {
              if (days === 1) return "1 day later";
              if (days === -1) return "1 day earlier";
              if (days > 1) return `${days} days later`;
              if (days < -1) return `${Math.abs(days)} days earlier`;
              return "Same week";
            }}
            formatFlightCount={(count) =>
              count > 1 ? `${count} flights available` : "1 flight available"
            }
            formatFromPrice={(amount) =>
              `From ${formatMoney(Math.round(amount))}`
            }
            suggestions={departureSuggestions}
            loading={loadingDepartureSuggestions}
            checked={departureSuggestionsChecked}
            onSelect={applyDepartureSuggestion}
          />
        </div>
      ) : null}

      {searching && flightResults.length === 0 && !searchError ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating available flights…
        </p>
      ) : null}

      {flightResults.length > 0 && (
        <FormSection title="Available flights" className="mt-6">
          {searching ? (
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing results…
            </p>
          ) : null}
          <div className="space-y-4">
            {flightResults.map((f) => (
              <FlightFareResultCard
                key={f.schedule_id}
                variant="portal"
                flight={flightSearchResultToFareDisplay(f, origin, destination, departureDate)}
                seatClasses={seatClasses}
                iataLabels={iataLabels}
                cabinFilter={seatClass}
                formatMoney={formatMoney}
                formatDate={(iso) =>
                  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                }
                labels={defaultFareCardLabels}
                isSelected={activeScheduleId === f.schedule_id}
                selectedClass={
                  activeScheduleId === f.schedule_id ? activeSeatClass : null
                }
                onSelect={(chosenClass) => selectFlight(f, chosenClass)}
              />
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
          onClick={() => void searchFlights({ validate: true })}
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
