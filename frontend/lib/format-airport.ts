import type { AirportSelectRow } from "@/lib/airport-select";
import type { AvailableRoute } from "@/services/search";

export type AirportDisplayInput = {
  city?: string | null;
  airportName?: string | null;
  iata?: string | null;
  linkName?: string | null;
};

/** Display label for an airport, e.g. Nairobi(NBO). */
export function formatAirportDisplay(input: AirportDisplayInput): string {
  const iata = (input.iata || input.linkName || "").trim().toUpperCase();
  const place = (input.city || input.airportName || "").trim();
  if (place && iata) return `${place}(${iata})`;
  if (place) return place;
  return iata || input.linkName?.trim() || "—";
}

export function formatRouteDisplay(
  origin: AirportDisplayInput,
  destination: AirportDisplayInput,
  separator = " → ",
): string {
  return `${formatAirportDisplay(origin)}${separator}${formatAirportDisplay(destination)}`;
}

export function buildAirportDisplayByLinkName(rows: AirportSelectRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of rows) {
    map.set(
      a.name,
      formatAirportDisplay({
        city: a.city,
        airportName: a.airport_name,
        iata: a.iata_code,
        linkName: a.name,
      }),
    );
  }
  return map;
}

export function buildIataLabelMapFromRoutes(routes: AvailableRoute[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of routes) {
    if (r.origin_code) {
      map.set(
        r.origin_code,
        formatAirportDisplay({ city: r.origin_city, iata: r.origin_code }),
      );
    }
    if (r.destination_code) {
      map.set(
        r.destination_code,
        formatAirportDisplay({ city: r.destination_city, iata: r.destination_code }),
      );
    }
  }
  return map;
}

export function labelForIata(
  code: string | undefined,
  labelsByIata?: Map<string, string> | null,
): string {
  if (!code) return "—";
  return labelsByIata?.get(code) || code;
}

export function endpointLabel(code?: string, label?: string): string {
  return label || code || "—";
}

export function formatFlightRouteLabel(flight: {
  origin_label?: string;
  destination_label?: string;
  origin_code?: string;
  destination_code?: string;
}): string {
  const origin = endpointLabel(flight.origin_code, flight.origin_label);
  const destination = endpointLabel(flight.destination_code, flight.destination_label);
  if (origin !== "—" && destination !== "—") return `${origin} → ${destination}`;
  return origin !== "—" ? origin : destination;
}
