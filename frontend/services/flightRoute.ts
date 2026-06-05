import { apiRequest, methodUrl } from "./apiClient";

export async function fetchAllRoutes() {
  return apiRequest(methodUrl("flight_route", "fetch_all_routes"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function findRoutes(origin: string, destination: string) {
  return apiRequest(methodUrl("flight_route", "find_routes"), {
    method: "POST",
    body: JSON.stringify({ origin, destination }),
  });
}

export type RouteSegmentRow = {
  segment_index: number;
  origin_airport: string;
  destination_airport: string;
  duration?: number | null;
  origin_airport_label?: string;
  destination_airport_label?: string;
};

export async function getFlightRoute(name: string) {
  return apiRequest<Record<string, unknown> & { route_segments?: RouteSegmentRow[] }>(
    methodUrl("portal", "get_flight_route"),
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}

export async function saveRoute(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(methodUrl("portal", "save_flight_route"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}
