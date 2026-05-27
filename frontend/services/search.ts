import { apiRequest, methodUrl } from "./apiClient";

export interface FlightSearchResult {
  flight_number: string;
  schedule_id: string;
  departure_time: string;
  arrival_time: string;
  available_seats: number;
  prices: Record<string, number>;
}

export interface FlightSearchResponse {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
  flights: FlightSearchResult[];
  error?: string;
}

export async function findFlights(
  origin: string,
  destination: string,
  date: string,
  passengers = 1,
): Promise<FlightSearchResponse> {
  return apiRequest(methodUrl("search", "find_flights"), {
    method: "POST",
    body: JSON.stringify({ origin, destination, date, passengers }),
  });
}

export async function fetchAllRoutes() {
  return apiRequest(methodUrl("search", "fetch_all_available_routes"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getBookingSearchDefaults(): Promise<{
  origin_iata: string;
  destination_iata: string;
  suggested_date: string;
}> {
  return apiRequest(methodUrl("search", "get_booking_search_defaults"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
