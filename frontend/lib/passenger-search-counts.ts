import { DEFAULT_CABIN, FALLBACK_CABIN_OPTIONS, type CabinClassOption } from "@/lib/cabin-classes";

export type PassengerSearchCounts = {
  adults: number;
  children: number;
  infants: number;
};

export type SeatClassOption = CabinClassOption;

export const DEFAULT_PASSENGER_COUNTS: PassengerSearchCounts = {
  adults: 1,
  children: 0,
  infants: 0,
};

export const SEAT_CLASS_OPTIONS: { value: SeatClassOption; label: string }[] = FALLBACK_CABIN_OPTIONS;

export const MAX_TRAVELERS_PER_BOOKING = 9;

export function totalPassengers(counts: PassengerSearchCounts): number {
  return counts.adults + counts.children + counts.infants;
}

/** Seats required for inventory search (infants travel on lap). */
export function seatsRequired(counts: PassengerSearchCounts): number {
  return counts.adults + counts.children;
}

export function normalizePassengerCounts(
  raw?: Partial<PassengerSearchCounts> | null,
): PassengerSearchCounts {
  const adults = Math.max(1, Math.min(MAX_TRAVELERS_PER_BOOKING, raw?.adults ?? 1));
  const children = Math.max(
    0,
    Math.min(MAX_TRAVELERS_PER_BOOKING - adults, raw?.children ?? 0),
  );
  const maxInfants = Math.min(adults, MAX_TRAVELERS_PER_BOOKING - adults - children);
  const infants = Math.max(0, Math.min(maxInfants, raw?.infants ?? 0));
  return { adults, children, infants };
}

export function parsePassengerCountsFromParams(
  searchParams: URLSearchParams,
): PassengerSearchCounts {
  const hasBreakdown =
    searchParams.has("adults") ||
    searchParams.has("children") ||
    searchParams.has("infants");

  if (hasBreakdown) {
    return normalizePassengerCounts({
      adults: parseInt(searchParams.get("adults") || "1", 10),
      children: parseInt(searchParams.get("children") || "0", 10),
      infants: parseInt(searchParams.get("infants") || "0", 10),
    });
  }

  const legacy = parseInt(searchParams.get("passengers") || "1", 10);
  if (Number.isFinite(legacy) && legacy > 0) {
    return normalizePassengerCounts({ adults: legacy, children: 0, infants: 0 });
  }

  return { ...DEFAULT_PASSENGER_COUNTS };
}

export function appendPassengerCountsToParams(
  params: URLSearchParams,
  counts: PassengerSearchCounts,
): void {
  const normalized = normalizePassengerCounts(counts);
  params.set("passengers", String(totalPassengers(normalized)));
  params.set("adults", String(normalized.adults));
  params.set("children", String(normalized.children));
  params.set("infants", String(normalized.infants));
}

export function parseSeatClassFromParams(searchParams: URLSearchParams): SeatClassOption {
  const value = searchParams.get("class");
  if (value && FALLBACK_CABIN_OPTIONS.some((opt) => opt.value === value)) return value;
  return DEFAULT_CABIN;
}

export function passengerTypesFromCounts(
  counts: PassengerSearchCounts,
): Array<"Adult" | "Child" | "Infant"> {
  const types: Array<"Adult" | "Child" | "Infant"> = [];
  for (let i = 0; i < counts.adults; i += 1) types.push("Adult");
  for (let i = 0; i < counts.children; i += 1) types.push("Child");
  for (let i = 0; i < counts.infants; i += 1) types.push("Infant");
  return types;
}

export function passengerCountsSummary(counts: PassengerSearchCounts): string {
  const parts: string[] = [];
  if (counts.adults) parts.push(`${counts.adults} adult${counts.adults > 1 ? "s" : ""}`);
  if (counts.children) parts.push(`${counts.children} child${counts.children > 1 ? "ren" : ""}`);
  if (counts.infants) parts.push(`${counts.infants} infant${counts.infants > 1 ? "s" : ""}`);
  return parts.join(", ");
}
