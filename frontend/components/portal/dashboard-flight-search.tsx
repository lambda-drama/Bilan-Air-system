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
import { useCurrency } from "@/contexts/currency-context";
import { formatAirportDisplay, formatRouteDisplay } from "@/lib/format-airport";
import {
  draftFromFlight,
  loadOfficeBookingDraft,
  saveOfficeBookingDraft,
} from "@/lib/office-booking-store";
import {
  findFlights,
  fetchAllRoutes,
  getBookingSearchDefaults,
  type AvailableRoute,
  type FlightSearchResult,
} from "@/services/search";

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
  const [passengerCount, setPassengerCount] = useState(1);
  const [airportOptions, setAirportOptions] = useState<{ value: string; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
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

  const runSearch = async () => {
    if (!departureDate) {
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
    try {
      const res =
        searchMode === "route"
          ? await findFlights({
              route: selectedRoute,
              date: departureDate,
              passengers: passengerCount,
            })
          : await findFlights({
              origin,
              destination,
              date: departureDate,
              passengers: passengerCount,
            });
      if (res.error) {
        setSearchError(res.error);
        return;
      }
      setFlightResults(res.flights || []);
      if (!res.flights?.length) setSearchError("No flights on this route and date.");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const selectFlight = (flight: FlightSearchResult) => {
    const existing = loadOfficeBookingDraft();
    saveOfficeBookingDraft({
      ...draftFromFlight(flight, {
        seatClass: "Economy",
        passengerCount,
        origin,
        destination,
        departureDate,
        route: searchMode === "route" ? selectedRoute : flight.route,
      }),
      selectedSeatIds:
        existing?.scheduleId === flight.schedule_id ? existing.selectedSeatIds : [],
      payer: existing?.payer,
      passengers: existing?.passengers,
      markPaid: existing?.markPaid,
    });
    router.push(`/portal/booking/new/seats?schedule=${encodeURIComponent(flight.schedule_id)}`);
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

            <FormGrid className="sm:grid-cols-2">
              <FormField label="Departure date" required>
                <Input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                />
              </FormField>
              <FormField label="Passengers">
                <Input
                  type="number"
                  min={1}
                  max={9}
                  value={passengerCount}
                  onChange={(e) =>
                    setPassengerCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                />
              </FormField>
            </FormGrid>

            {searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}

            {flightResults.length > 0 ? (
              <div className="space-y-2">
                {flightResults.map((f) => (
                  <button
                    key={f.schedule_id}
                    type="button"
                    onClick={() => selectFlight(f)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-gold hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{f.flight_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {f.departure_time} → {f.arrival_time} · {f.available_seats} seats
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gold">
                      {formatMoney(f.prices?.Economy ?? Object.values(f.prices || {})[0])}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <Button
              className="w-full bg-gold text-navy hover:bg-gold-dark sm:w-auto"
              onClick={runSearch}
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
