import { apiRequest, methodUrl } from "./apiClient";

export interface FlightSearchResult {
  flight_number: string;
  schedule_id: string;
  departure_time: string;
  arrival_time: string;
  available_seats: number;
  prices: Record<string, number>;
  route?: string;
}

export interface FlightSearchResponse {
  origin?: string;
  destination?: string;
  date: string;
  passengers: number;
  route?: string;
  flights: FlightSearchResult[];
  error?: string;
}

export type FindFlightsParams = {
  date: string;
  passengers?: number;
  /** Flight Route document name */
  route?: string;
  /** Origin airport IATA or link name */
  origin?: string;
  /** Destination airport IATA or link name */
  destination?: string;
};

export async function findFlights(
  originOrParams: string | FindFlightsParams,
  destination?: string,
  date?: string,
  passengers = 1,
): Promise<FlightSearchResponse> {
  const body: Record<string, unknown> =
    typeof originOrParams === "string"
      ? { origin: originOrParams, destination, date, passengers }
      : {
          ...originOrParams,
          passengers: originOrParams.passengers ?? 1,
        };

  return apiRequest(methodUrl("search", "find_flights"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getScheduleForOfficeBooking(
  scheduleId: string,
  passengers = 1,
): Promise<{
  flight?: FlightSearchResult;
  route?: string;
  origin_iata?: string;
  destination_iata?: string;
  date?: string;
  error?: string;
}> {
  return apiRequest(methodUrl("search", "get_schedule_for_office_booking"), {
    method: "POST",
    body: JSON.stringify({ schedule_id: scheduleId, passengers }),
  });
}

export interface AvailableRoute {
  name: string;
  route_name?: string;
  origin_code?: string;
  origin_city?: string;
  destination_code?: string;
  destination_city?: string;
  base_fare?: number;
}

export async function fetchAllRoutes(): Promise<AvailableRoute[]> {
  return apiRequest(methodUrl("search", "fetch_all_available_routes"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getBookingSearchDefaults(): Promise<{
  origin_iata: string;
  destination_iata: string;
  suggested_date: string;
  route?: string;
}> {
  return apiRequest(methodUrl("search", "get_booking_search_defaults"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
