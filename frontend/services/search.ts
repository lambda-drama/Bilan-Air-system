import { apiRequest, methodUrl } from "./apiClient";

export interface FlightSearchResult {
  flight_number: string;
  schedule_id: string;
  departure_date?: string;
  arrival_date?: string;
  departure_time: string;
  arrival_time: string;
  available_seats: number;
  prices: Record<string, number>;
  route?: string;
  is_multi_segment?: boolean;
  stop_count?: number;
  aircraft_model?: string | null;
  operator?: string | null;
  is_active?: number | boolean;
  only_prepayment?: number | boolean;
}

export interface PublicCabinClassOption {
  name: string;
  cabin_name: string;
  display_order?: number;
  color_code?: string | null;
  description?: string | null;
  checked_baggage_kg: number;
  checked_baggage_pieces?: number;
  carry_on_kg?: number;
}

export interface PublicSeatClassOption {
  name: string;
  class_name: string;
  cabin_class?: string;
  cabin_name?: string;
  use_on_aircraft_layout?: number | boolean;
  price_multiplier?: number;
  color_code?: string | null;
  checked_baggage_kg: number;
  checked_baggage_pieces?: number;
  carry_on_kg?: number;
  description?: string | null;
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
  base_fares?: { adult: number; child?: number; infant?: number };
}

export async function fetchAllRoutes(): Promise<AvailableRoute[]> {
  return apiRequest(methodUrl("search", "fetch_all_available_routes"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchPublicSeatClasses(): Promise<PublicSeatClassOption[]> {
  const res = await apiRequest<{ seat_classes: PublicSeatClassOption[] }>(
    methodUrl("search", "list_public_seat_classes"),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  return res.seat_classes || [];
}

export async function fetchPublicCabinClasses(): Promise<PublicCabinClassOption[]> {
  const res = await apiRequest<{ cabin_classes: PublicCabinClassOption[] }>(
    methodUrl("search", "list_public_cabin_classes"),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  return res.cabin_classes || [];
}

export async function getBookingSearchDefaults(): Promise<{
  origin_iata: string;
  destination_iata: string;
  suggested_date: string;
  route?: string | null;
  enable_seat_selection?: boolean;
}> {
  return apiRequest(methodUrl("search", "get_booking_search_defaults"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface PublicScheduleRow {
  schedule_id: string;
  flight_number: string;
  route: string;
  route_name?: string;
  origin: string;
  destination: string;
  origin_code: string;
  destination_code: string;
  origin_label?: string;
  destination_label?: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  status: string;
  airplane: string;
  available_seats: number;
  prices: Record<string, number>;
  bookable: boolean;
}

export interface ListPublicSchedulesResponse {
  flights: PublicScheduleRow[];
  date_from: string;
  date_to: string;
  count: number;
}

export type ListPublicSchedulesParams = {
  date?: string;
  date_from?: string;
  date_to?: string;
  origin?: string;
  destination?: string;
  route?: string;
  flight_number?: string;
  status?: string;
  passengers?: number;
  bookable_only?: boolean;
  limit?: number;
};

export interface NearestFlightDateSuggestion {
  date: string;
  flight_count: number;
  days_from_anchor: number;
  min_fare?: number | null;
}

export async function suggestNearestFlightDates(params: {
  origin: string;
  destination: string;
  anchor_date: string;
  min_date?: string;
  passengers?: number;
  max_suggestions?: number;
}): Promise<{ suggestions: NearestFlightDateSuggestion[]; anchor_date: string }> {
  return apiRequest(methodUrl("search", "suggest_nearest_flight_dates"), {
    method: "POST",
    body: JSON.stringify({
      origin: params.origin,
      destination: params.destination,
      anchor_date: params.anchor_date,
      min_date: params.min_date || undefined,
      passengers: params.passengers ?? 1,
      max_suggestions: params.max_suggestions ?? 3,
    }),
  });
}

export async function listPublicSchedules(
  params: ListPublicSchedulesParams = {},
): Promise<ListPublicSchedulesResponse> {
  return apiRequest(methodUrl("search", "list_public_schedules"), {
    method: "POST",
    body: JSON.stringify({
      date: params.date || undefined,
      date_from: params.date_from || undefined,
      date_to: params.date_to || undefined,
      origin: params.origin?.trim() || undefined,
      destination: params.destination?.trim() || undefined,
      route: params.route?.trim() || undefined,
      flight_number: params.flight_number?.trim() || undefined,
      status: params.status?.trim() || undefined,
      passengers: params.passengers ?? 1,
      bookable_only: params.bookable_only ? 1 : 0,
      limit: params.limit ?? 150,
    }),
  });
}
