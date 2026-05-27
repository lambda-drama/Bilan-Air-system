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

export async function saveRoute(data: Record<string, unknown>) {
  return apiRequest(methodUrl("portal", "save_flight_route"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}
