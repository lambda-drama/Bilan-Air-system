import { apiRequest, methodUrl } from "./apiClient";
import type { AirportSelectRow } from "@/lib/airport-select";

export type { AirportSelectRow };

/** Public site — active airports only. */
export async function fetchAllAirports() {
  return apiRequest<AirportSelectRow[]>(methodUrl("airport", "fetch_all_airports"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Portal — all airports with full fields for dropdowns (not routes). */
export async function fetchAirportsForPortal(limit = 500) {
  const res = await apiRequest<{ data: AirportSelectRow[] }>(
    methodUrl("portal_master", "list_airports"),
    {
      method: "POST",
      body: JSON.stringify({ limit, offset: 0 }),
    },
  );
  return res.data ?? [];
}
