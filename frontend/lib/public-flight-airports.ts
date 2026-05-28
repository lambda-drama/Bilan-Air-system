import type { AvailableRoute } from "@/services/search";

export interface AirportOption {
  code: string;
  city: string;
}

/** Origins and destinations derived from active flight routes (real Airport IATA codes). */
export function buildAirportOptionsFromRoutes(routes: AvailableRoute[]) {
  const origins = new Map<string, AirportOption>();
  const destinationsByOrigin = new Map<string, Map<string, AirportOption>>();

  for (const r of routes) {
    const oCode = r.origin_code?.trim();
    const dCode = r.destination_code?.trim();
    if (!oCode) continue;

    origins.set(oCode, {
      code: oCode,
      city: r.origin_city?.trim() || oCode,
    });

    if (!destinationsByOrigin.has(oCode)) {
      destinationsByOrigin.set(oCode, new Map());
    }
    if (dCode) {
      destinationsByOrigin.get(oCode)!.set(dCode, {
        code: dCode,
        city: r.destination_city?.trim() || dCode,
      });
    }
  }

  const sortedOrigins = [...origins.values()].sort((a, b) =>
    a.city.localeCompare(b.city),
  );

  return { origins: sortedOrigins, destinationsByOrigin };
}

export function destinationsForOrigin(
  destinationsByOrigin: Map<string, Map<string, AirportOption>>,
  originCode: string,
): AirportOption[] {
  const map = destinationsByOrigin.get(originCode);
  if (!map) return [];
  return [...map.values()].sort((a, b) => a.city.localeCompare(b.city));
}
