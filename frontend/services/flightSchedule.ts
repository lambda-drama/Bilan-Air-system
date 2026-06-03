import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

export interface SeatMapEntry {
  name: string;
  seat_number: string;
  status: string;
  booked_by?: string | null;
}

export type SeatMap = Record<string, SeatMapEntry[]>;

export interface FlightScheduleRow {
  name: string;
  flight_number: string;
  route: string;
  airplane: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  status: string;
}

export async function fetchSeatMap(flight_schedule_name: string): Promise<SeatMap> {
  return apiRequest(methodUrl("flight_schedule", "fetch_seat_map"), {
    method: "POST",
    body: JSON.stringify({ flight_schedule_name }),
  });
}

export async function fetchFlightDetails(schedule_id: string) {
  return apiRequest(methodUrl("flight_schedule", "fetch_flight_details"), {
    method: "POST",
    body: JSON.stringify({ schedule_id }),
  });
}

export async function getFlightSchedule(schedule_name: string) {
  return apiRequest<{
    name: string;
    flight_number: string;
    route: string;
    airplane: string;
    departure_date: string;
    departure_time: string;
    arrival_date: string;
    arrival_time: string;
    status: string;
    captain: string;
    first_officer: string;
    base_fare_override?: number | null;
    docstatus: number;
  }>(methodUrl("portal", "get_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({ schedule_name }),
  });
}

export async function listSchedules(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<FlightScheduleRow>>(
    methodUrl("portal", "list_flight_schedules"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
        status: opts?.status ?? null,
        search: opts?.search ?? null,
      }),
    },
  );
}

export async function saveSchedule(
  data: Record<string, unknown>,
  opts?: { submit?: boolean },
) {
  return apiRequest<
    Record<string, unknown> & { seats_created?: number; submitted?: boolean }
  >(methodUrl("portal", "save_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({
      data,
      submit: opts?.submit !== false ? 1 : 0,
    }),
  });
}

export async function ensureScheduleSeats(scheduleName: string) {
  return apiRequest<{
    schedule: string;
    seats_before: number;
    seats_created: number;
    seats_total: number;
  }>(methodUrl("portal", "ensure_schedule_seats"), {
    method: "POST",
    body: JSON.stringify({ schedule_name: scheduleName }),
  });
}

export async function cancelFlightSchedule(schedule_name: string, cancel_reason: string) {
  return apiRequest<{ name: string; status: string; docstatus: number }>(
    methodUrl("portal", "cancel_flight_schedule"),
    {
      method: "POST",
      body: JSON.stringify({ schedule_name, cancel_reason: cancel_reason.trim() }),
    },
  );
}

export async function amendFlightSchedule(
  schedule_name: string,
  data: Record<string, unknown>,
  opts?: { submit?: boolean },
) {
  return apiRequest<
    Record<string, unknown> & { seats_created?: number; submitted?: boolean; name?: string }
  >(methodUrl("portal", "amend_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({
      schedule_name,
      data,
      submit: opts?.submit !== false ? 1 : 0,
    }),
  });
}

export async function rescheduleFlight(params: {
  schedule_name: string;
  reschedule_reason: string;
  new_departure_date: string;
  new_departure_time: string;
  new_arrival_date: string;
  new_arrival_time: string;
  new_airplane?: string;
  notes?: string;
}) {
  return apiRequest(
    "/api/method/bilan_sky.bilan_air_booking_system.doctype.flight_schedule.flight_schedule.reschedule_flight",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
}
