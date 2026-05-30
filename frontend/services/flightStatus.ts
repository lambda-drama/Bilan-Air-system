import { apiRequest, methodUrl } from "./apiClient";

export interface FlightStatusRow {
  schedule_id: string;
  flight_number: string;
  route: string;
  origin: string;
  destination: string;
  origin_code: string;
  destination_code: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  status: string;
  terminal_gate: string;
  airplane: string;
}

export interface FlightStatusResult {
  flights: FlightStatusRow[];
  date: string;
  updated_at: string;
}

export async function listFlightStatus(params?: {
  date?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  booking_reference?: string;
}) {
  return apiRequest<FlightStatusResult>(methodUrl("flight_schedule", "list_flight_status"), {
    method: "POST",
    body: JSON.stringify({
      date: params?.date || undefined,
      flight_number: params?.flight_number?.trim() || undefined,
      origin: params?.origin?.trim() || undefined,
      destination: params?.destination?.trim() || undefined,
      booking_reference: params?.booking_reference?.trim() || undefined,
    }),
  });
}
