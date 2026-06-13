"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plane, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, FormGrid } from "@/components/portal/form-dialog";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { FlightSearchPassengersCabin } from "@/components/flight-search-passengers-cabin";
import { NearestFlightDatesPanel } from "@/components/nearest-flight-dates-panel";
import { useCurrency } from "@/contexts/currency-context";
import { formatAirportDisplay, formatRouteDisplay } from "@/lib/format-airport";
import { officeBookingAfterFlightPath } from "@/lib/booking-seat-step";
import { cabinOptionsFromApi } from "@/lib/cabin-classes";
import {
  DEFAULT_PASSENGER_COUNTS,
  seatsRequired,
  totalPassengers,
  SEAT_CLASS_OPTIONS,
  type PassengerSearchCounts,
  type SeatClassOption,
} from "@/lib/passenger-search-counts";
import {
  draftFromFlight,
  loadOfficeBookingDraft,
  saveOfficeBookingDraft,
} from "@/lib/office-booking-store";
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

export function DashboardFlightSearch() {
  const router = useRouter();
  const { formatMoney } = useCurrency();

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
  const [enableSeatSelection, setEnableSeatSelection] = useState(false);
  const [seatClasses, setSeatClasses] = useState<PublicSeatClassOption[]>([]);
  const [cabinOptions, setCabinOptions] = useState(SEAT_CLASS_OPTIONS);

  useEffect(() => {
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
        setEnableSeatSelection(!!defaults.enable_seat_selection);
        setOrigin(defaults.origin_iata || "");
        setDestination(defaults.destination_iata || "");
        setDepartureDate(defaults.suggested_date || "");
        setSelectedRoute(defaults.route || routes[0]?.name || "");
      })
      .catch(() => {
        if (!cancelled) setSearchError("Could not load routes.");
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const loadDepartureSuggestions = async (anchorDate: string) => {
    const legOrigin = searchMode === "route" ? origin : origin;
    const legDestination = searchMode === "route" ? destination : destination;
    if (!legOrigin || !legDestination || !anchorDate) return;
    setLoadingDepartureSuggestions(true);
    setDepartureSuggestionsChecked(false);
    setDepartureSuggestions([]);
    try {
      const res = await suggestNearestFlightDates({
        origin: legOrigin,
        destination: legDestination,
        anchor_date: anchorDate,
        passengers: seatsRequired(passengerCounts),
      });
      setDepartureSuggestions(res.suggestions || []);
    } catch {
      setDepartureSuggestions([]);
    } finally {
      setLoadingDepartureSuggestions(false);
      setDepartureSuggestionsChecked(true);
    }
  };

  const runSearch = async (dateOverride?: string) => {
    const searchDate = dateOverride || departureDate;
    if (!searchDate) {
      setSearchError("Departure date is required.");
      return;
    }
    if (searchMode === "route" && !selectedRoute) {
      setSearchError("Select a route.");
      return;
    }
    if (searchMode === "airports" && (!origin || !destination)) {
      setSearchError("Select origin and destination airports.");
      return;
    }

    setSearchError("");
    setSearching(true);
    setFlightResults([]);
    setDepartureSuggestions([]);
    setDepartureSuggestionsChecked(false);
    const seatNeed = seatsRequired(passengerCounts);
    try {
      const res =
        searchMode === "route"
          ? await findFlights({
              route: selectedRoute,
              date: searchDate,
              passengers: seatNeed,
            })
          : await findFlights({
              origin,
              destination,
              date: searchDate,
              passengers: seatNeed,
            });
      if (res.error) {
        setSearchError(res.error);
        void loadDepartureSuggestions(searchDate);
        return;
      }
      setFlightResults(res.flights || []);
      if (!res.flights?.length) {
        setSearchError("No flights on this route and date.");
        void loadDepartureSuggestions(searchDate);
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const applyDepartureSuggestion = (suggestedDate: string) => {
    setDepartureDate(suggestedDate);
    void runSearch(suggestedDate);
  };

  const selectFlight = (flight: FlightSearchResult, chosenClass: string) => {
    const cabinClassName =
      seatClasses.find((sc) => sc.class_name === chosenClass)?.cabin_name || seatClass;
    const paxTotal = totalPassengers(passengerCounts);
    const existing = loadOfficeBookingDraft();
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
      selectedSeatIds:
        existing?.scheduleId === flight.schedule_id ? existing.selectedSeatIds : [],
      payer: existing?.payer,
      passengers: existing?.passengers,
      markPaid: existing?.markPaid,
    });
    router.push(officeBookingAfterFlightPath(flight.schedule_id, enableSeatSelection));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-gold" />
          <CardTitle>Search flights</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/booking/new">Office booking</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {initializing ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading routes...
          </p>
        ) : (
          <>
            <Tabs
              value={searchMode}
              onValueChange={(v) => {
                setSearchMode(v as SearchMode);
                setSearchError("");
                setFlightResults([]);
                setDepartureSuggestions([]);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="route">By route</TabsTrigger>
                <TabsTrigger value="airports">By airports</TabsTrigger>
              </TabsList>
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
                      placeholder="Origin..."
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
                      placeholder="Destination..."
                      clearable={false}
                    />
                  </FormField>
                </FormGrid>
              </TabsContent>
            </Tabs>

            <FormField label="Departure date" required>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              />
            </FormField>

            <FlightSearchPassengersCabin
              counts={passengerCounts}
              onCountsChange={setPassengerCounts}
              seatClass={seatClass}
              onSeatClassChange={setSeatClass}
              cabinOptions={cabinOptions}
              variant="portal"
              disabled={searching}
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
              <div className="space-y-3">
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

            {flightResults.length > 0 ? (
              <div className="space-y-4">
                {flightResults.map((f) => (
                  <FlightFareResultCard
                    key={f.schedule_id}
                    variant="portal"
                    flight={flightSearchResultToFareDisplay(f, origin, destination, departureDate)}
                    seatClasses={seatClasses}
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
                    onSelect={(chosenClass) => selectFlight(f, chosenClass)}
                  />
                ))}
              </div>
            ) : null}

            <Button
              className="w-full bg-gold text-navy hover:bg-gold-dark sm:w-auto"
              onClick={() => runSearch()}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search flights
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
