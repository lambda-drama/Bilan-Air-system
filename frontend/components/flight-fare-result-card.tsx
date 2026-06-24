"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Luggage,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelForIata } from "@/lib/format-airport";
import { formatFareClassLabel } from "@/lib/fare-class-display";
import type { PublicSeatClassOption } from "@/services/search";
import { cn } from "@/lib/utils";

type FareCardTheme = {
  headerClass: string;
  priceClass: string;
  /** Filled gold/navy CTA vs outline */
  accentStrong: boolean;
};

/** Brand fare tiers: light gold (thin) → full gold → navy + gold (thick) */
const BRAND_FARE_THEMES: FareCardTheme[] = [
  { headerClass: "bg-gold/15 text-navy border-b border-gold/25", priceClass: "text-navy", accentStrong: false },
  { headerClass: "bg-gold/35 text-navy", priceClass: "text-gold-dark", accentStrong: false },
  { headerClass: "bg-gold text-navy", priceClass: "text-navy", accentStrong: true },
  { headerClass: "bg-navy text-gold", priceClass: "text-gold", accentStrong: true },
];

/** Portal / dark-theme fare tiers — use semantic tokens, not fixed white cards */
const PORTAL_FARE_THEMES: FareCardTheme[] = [
  { headerClass: "bg-gold/15 text-foreground border-b border-gold/25", priceClass: "text-gold", accentStrong: false },
  { headerClass: "bg-gold/30 text-foreground", priceClass: "text-gold", accentStrong: false },
  { headerClass: "bg-gold text-navy", priceClass: "text-navy", accentStrong: true },
  { headerClass: "bg-navy text-gold", priceClass: "text-gold", accentStrong: true },
];

function fareCardTheme(
  seatClass: PublicSeatClassOption,
  index: number,
  isWebsite: boolean,
): FareCardTheme {
  const themes = isWebsite ? BRAND_FARE_THEMES : PORTAL_FARE_THEMES;
  const name = (seatClass.cabin_name || seatClass.class_name).toLowerCase();
  if (name.includes("first")) {
    return themes[3];
  }
  if (name.includes("business")) {
    return themes[2];
  }
  if (name.includes("economy")) {
    return themes[0];
  }
  return themes[index % themes.length];
}

export type FlightFareDisplay = {
  scheduleId: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  departureDate: string;
  arrivalDate?: string;
  originCode: string;
  destinationCode: string;
  availableSeats: number;
  prices: Record<string, number>;
  aircraftModel?: string | null;
  operator?: string | null;
  stopCount?: number;
};

type FlightFareResultCardLabels = {
  adultFare: string;
  checkedBaggage: string;
  changeFee: string;
  refundFee: string;
  noShowFee: string;
  select: string;
  selected: string;
  direct: string;
  stops: string;
  operatedBy: string;
  standardPolicy: string;
  seatsAvailable: string;
};

type FlightFareResultCardProps = {
  flight: FlightFareDisplay;
  seatClasses: PublicSeatClassOption[];
  iataLabels?: Map<string, string>;
  formatMoney: (amount: number) => string;
  formatDate: (iso: string) => string;
  labels: FlightFareResultCardLabels;
  variant?: "website" | "portal";
  selectedClass?: string | null;
  isSelected?: boolean;
  defaultExpanded?: boolean;
  /** Filter fare cards to a cabin (Economy, Business, …). */
  cabinFilter?: string | null;
  onSelect: (seatClass: string, price: number) => void;
};

function fareOptionsForFlight(
  flight: FlightFareDisplay,
  seatClasses: PublicSeatClassOption[],
  cabinFilter?: string | null,
) {
  let classes = seatClasses;
  if (cabinFilter) {
    classes = classes.filter(
      (sc) => (sc.cabin_name || sc.class_name) === cabinFilter,
    );
  }
  const priceKeys = Object.keys(flight.prices || {});
  const ordered = classes.filter((sc) => priceKeys.includes(sc.class_name));
  const extras = priceKeys
    .filter((name) => !ordered.some((sc) => sc.class_name === name))
    .map((class_name) => ({
      name: class_name,
      class_name,
      checked_baggage_kg: 30,
      checked_baggage_pieces: 1,
      carry_on_kg: 7,
    }));
  return [...ordered, ...extras];
}

export function FlightFareResultCard({
  flight,
  seatClasses,
  iataLabels,
  formatMoney,
  formatDate,
  labels,
  variant = "website",
  selectedClass,
  isSelected,
  defaultExpanded = true,
  cabinFilter,
  onSelect,
}: FlightFareResultCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isWebsite = variant === "website";

  const fareOptions = useMemo(
    () => fareOptionsForFlight(flight, seatClasses, cabinFilter),
    [flight, seatClasses, cabinFilter],
  );

  const cheapestPrice = useMemo(() => {
    const values = fareOptions
      .map((opt) => flight.prices[opt.class_name])
      .filter((v) => typeof v === "number" && v > 0);
    return values.length ? Math.min(...values) : 0;
  }, [fareOptions, flight.prices]);

  const scrollCards = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  };

  const originLabel = labelForIata(flight.originCode, iataLabels);
  const destinationLabel = labelForIata(flight.destinationCode, iataLabels);
  const stopLabel =
    (flight.stopCount ?? 0) > 0
      ? labels.stops.replace("{count}", String(flight.stopCount))
      : labels.direct;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm transition-colors",
        isWebsite
          ? cn(
              "bg-white",
              isSelected
                ? "border-gold ring-2 ring-gold/30"
                : "border-navy/10 hover:border-gold/40",
            )
          : cn(
              "bg-card text-card-foreground",
              isSelected
                ? "border-gold ring-2 ring-gold/20"
                : "border-border hover:border-gold/40",
            ),
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 border-b px-4 py-4 sm:px-5",
          isWebsite ? "bg-cream/80 border-navy/10" : "bg-muted/30 border-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", isWebsite ? "text-navy/50" : "text-muted-foreground")}>
              {originLabel} ({flight.originCode}) — {destinationLabel} ({flight.destinationCode})
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
              <div>
                <p className={cn("text-2xl font-bold tabular-nums", isWebsite ? "text-navy" : "text-foreground")}>
                  {flight.departureTime}
                </p>
                <p className={cn("text-sm", isWebsite ? "text-navy/60" : "text-muted-foreground")}>
                  {formatDate(flight.departureDate)}
                </p>
                <p className={cn("text-sm font-medium", isWebsite ? "text-navy" : "text-foreground")}>
                  {originLabel} ({flight.originCode})
                </p>
              </div>

              <div className="flex flex-col items-center px-2">
                <ArrowRight className="h-5 w-5 text-gold" />
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    isWebsite ? "text-navy/60" : "text-muted-foreground",
                  )}
                >
                  {stopLabel}
                </p>
              </div>

              <div className="sm:text-right">
                <p className={cn("text-2xl font-bold tabular-nums", isWebsite ? "text-navy" : "text-foreground")}>
                  {flight.arrivalTime}
                </p>
                <p className={cn("text-sm", isWebsite ? "text-navy/60" : "text-muted-foreground")}>
                  {formatDate(flight.arrivalDate || flight.departureDate)}
                </p>
                <p className={cn("text-sm font-medium", isWebsite ? "text-navy" : "text-foreground")}>
                  {destinationLabel} ({flight.destinationCode})
                </p>
              </div>

              <div className="hidden sm:block sm:text-right">
                <span
                  className={cn(
                    "inline-flex rounded-md bg-gold/20 px-2 py-1 text-xs font-bold",
                    isWebsite ? "text-navy" : "text-gold",
                  )}
                >
                  {flight.flightNumber}
                </span>
                {flight.aircraftModel ? (
                  <p className={cn("mt-2 text-xs", isWebsite ? "text-navy/60" : "text-muted-foreground")}>
                    {flight.aircraftModel}
                  </p>
                ) : null}
                {flight.operator ? (
                  <p className={cn("text-xs", isWebsite ? "text-navy/50" : "text-muted-foreground")}>
                    {labels.operatedBy}: {flight.operator}
                  </p>
                ) : null}
                <p className={cn("mt-1 text-xs", isWebsite ? "text-navy/50" : "text-muted-foreground")}>
                  {labels.seatsAvailable.replace("{count}", String(flight.availableSeats))}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "shrink-0 rounded-md p-1.5 transition-colors",
              isWebsite
                ? "text-navy/60 hover:bg-gold/10 hover:text-gold-dark"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse fares" : "Expand fares"}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        <div className="sm:hidden">
          <span
            className={cn(
              "inline-flex rounded-md bg-gold/20 px-2 py-1 text-xs font-bold",
              isWebsite ? "text-navy" : "text-gold",
            )}
          >
            {flight.flightNumber}
          </span>
          {flight.aircraftModel ? (
            <p className="mt-2 text-xs text-muted-foreground">{flight.aircraftModel}</p>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="relative px-2 py-4 sm:px-4">
          {fareOptions.length > 3 ? (
            <>
              <button
                type="button"
                onClick={() => scrollCards("left")}
                className={cn(
                  "absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border p-2 shadow-md sm:flex",
                  isWebsite
                    ? "bg-white hover:bg-muted"
                    : "border-border bg-card hover:bg-accent",
                )}
                aria-label="Scroll fares left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCards("right")}
                className={cn(
                  "absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border p-2 shadow-md sm:flex",
                  isWebsite
                    ? "bg-white hover:bg-muted"
                    : "border-border bg-card hover:bg-accent",
                )}
                aria-label="Scroll fares right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin"
          >
            {fareOptions.map((seatClass, index) => {
              const price = flight.prices[seatClass.class_name] ?? 0;
              const theme = fareCardTheme(seatClass, index, isWebsite);
              const isCheapest = price > 0 && price === cheapestPrice;
              const cardSelected = isSelected && selectedClass === seatClass.class_name;
              const useFilledButton = cardSelected || isCheapest || theme.accentStrong;

              return (
                <div
                  key={seatClass.class_name}
                  className={cn(
                    "flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border shadow-sm",
                    isWebsite ? "bg-white" : "bg-muted/40",
                    cardSelected
                      ? "ring-2 ring-gold"
                      : isWebsite
                        ? "border-navy/10"
                        : "border-border",
                  )}
                >
                  <div className={cn("px-3 py-2 text-center text-sm font-bold", theme.headerClass)}>
                    {seatClass.display_label ||
                      formatFareClassLabel(seatClass.class_name, seatClass.cabin_name)}
                  </div>

                  <div className="flex flex-1 flex-col px-3 py-3">
                    <p className="text-xs font-medium text-muted-foreground">{labels.adultFare}</p>
                    <p className={cn("mt-1 text-2xl font-bold tabular-nums", theme.priceClass)}>
                      {formatMoney(Math.round(price))}
                    </p>

                    <ul
                      className={cn(
                        "mt-4 space-y-2.5 text-xs",
                        isWebsite ? "text-navy/60" : "text-muted-foreground",
                      )}
                    >
                      <li className="flex items-start gap-2">
                        <Luggage className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                        <span>
                          {labels.checkedBaggage.replace(
                            "{kg}",
                            String(Math.round(seatClass.checked_baggage_kg)),
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/80" />
                        <span>
                          {labels.changeFee}: {labels.standardPolicy}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/80" />
                        <span>
                          {labels.refundFee}: {labels.standardPolicy}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/80" />
                        <span>
                          {labels.noShowFee}: {labels.standardPolicy}
                        </span>
                      </li>
                    </ul>

                    <Button
                      type="button"
                      onClick={() => onSelect(seatClass.class_name, price)}
                      className={cn(
                        "mt-4 w-full rounded-full font-semibold",
                        useFilledButton
                          ? theme.headerClass.includes("bg-navy")
                            ? "bg-navy text-gold hover:bg-navy-light"
                            : "bg-gold text-navy hover:bg-gold-dark"
                          : isWebsite
                            ? "border border-gold/40 bg-white text-navy hover:bg-gold/10"
                            : "border border-gold/40 bg-transparent text-foreground hover:bg-gold/10",
                      )}
                      variant={useFilledButton ? "default" : "outline"}
                    >
                      {cardSelected ? labels.selected : labels.select}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function flightSearchResultToFareDisplay(
  flight: {
    schedule_id: string;
    flight_number: string;
    departure_time: string;
    arrival_time: string;
    departure_date?: string;
    arrival_date?: string;
    available_seats: number;
    prices: Record<string, number>;
    aircraft_model?: string | null;
    operator?: string | null;
    stop_count?: number;
  },
  originCode: string,
  destinationCode: string,
  fallbackDate: string,
): FlightFareDisplay {
  return {
    scheduleId: flight.schedule_id,
    flightNumber: flight.flight_number,
    departureTime: flight.departure_time,
    arrivalTime: flight.arrival_time,
    departureDate: flight.departure_date || fallbackDate,
    arrivalDate: flight.arrival_date || flight.departure_date || fallbackDate,
    originCode,
    destinationCode,
    availableSeats: flight.available_seats,
    prices: flight.prices || {},
    aircraftModel: flight.aircraft_model,
    operator: flight.operator,
    stopCount: flight.stop_count,
  };
}

export function scheduleRowToFareDisplay(
  flight: {
    name: string;
    flight_number: string;
    departure_date: string;
    arrival_date?: string;
    departure_time: string;
    arrival_time: string;
    origin_code: string;
    destination_code: string;
    available_seats: number;
    aircraft?: string;
    aircraft_name?: string;
  },
  prices: Record<string, number>,
  extras?: Partial<FlightFareDisplay>,
): FlightFareDisplay {
  return {
    scheduleId: flight.name,
    flightNumber: flight.flight_number,
    departureTime: flight.departure_time,
    arrivalTime: flight.arrival_time,
    departureDate: flight.departure_date,
    arrivalDate: flight.arrival_date || flight.departure_date,
    originCode: flight.origin_code,
    destinationCode: flight.destination_code,
    availableSeats: flight.available_seats,
    prices,
    aircraftModel: flight.aircraft_name || flight.aircraft,
    ...extras,
  };
}

export const defaultFareCardLabels: FlightFareResultCardLabels = {
  adultFare: "Adult Fare",
  checkedBaggage: "Checked baggage {kg} kg",
  changeFee: "Change fee",
  refundFee: "Refund fee",
  noShowFee: "No-show fee",
  select: "SELECT",
  selected: "SELECTED",
  direct: "Direct",
  stops: "{count} stop(s)",
  operatedBy: "Operated by",
  standardPolicy: "Standard policy",
  seatsAvailable: "{count} seats available",
};
