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
  route_label?: string;
  airplane: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  status: string;
  is_active?: number | boolean;
  only_prepayment?: number | boolean;
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
    is_active?: number | boolean;
    only_prepayment?: number | boolean;
    base_fare_override?: number | null;
    base_fares?: { adult: number; child: number; infant: number };
    route_base_fares?: { adult: number; child: number; infant: number };
    base_fares_override?: Partial<{ adult: number; child: number; infant: number }> | null;
    docstatus: number;
    fare_history?: FlightScheduleFareHistoryRow[];
  }>(methodUrl("portal", "get_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({ schedule_name }),
  });
}

export async function listSchedules(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  upcoming?: boolean;
  search?: string;
  departure_date?: string;
  departure_time?: string;
}) {
  return apiRequest<PaginatedResponse<FlightScheduleRow>>(
    methodUrl("portal", "list_flight_schedules"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
        status: opts?.status ?? null,
        upcoming: opts?.upcoming ? 1 : 0,
        search: opts?.search ?? null,
        departure_date: opts?.departure_date ?? null,
        departure_time: opts?.departure_time ?? null,
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

export async function releaseScheduleSeats(scheduleName: string, count: number) {
  return apiRequest<{
    released_now: number;
    seats_released_count: number;
    total_aircraft_capacity: number;
    unreleased_remaining: number;
    message?: string;
  }>(methodUrl("portal", "release_schedule_seats"), {
    method: "POST",
    body: JSON.stringify({ schedule_name: scheduleName, count }),
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

export type ScheduleCancellationPreview = {
  active_bookings_count: number;
  paid_bookings_count: number;
  unpaid_bookings_count: number;
  paid_bookings: Array<{
    name: string;
    pnr?: string | null;
    payment_status: string;
    total_fare: number;
    payer_name?: string;
  }>;
  total_paid_fare: number;
};

export async function getScheduleCancellationPreview(schedule_name: string) {
  return apiRequest<ScheduleCancellationPreview>(
    methodUrl("portal", "get_schedule_cancellation_preview"),
    {
      method: "POST",
      body: JSON.stringify({ schedule_name }),
    },
  );
}

export async function cancelFlightSchedule(
  schedule_name: string,
  cancel_reason: string,
  opts?: {
    refund_type?: "full" | "partial";
    refund_amount?: number;
  },
) {
  return apiRequest<{
    name: string;
    status: string;
    docstatus: number;
    bookings_cancelled?: number;
    refunds?: Array<{
      booking: string;
      pnr?: string | null;
      return_invoice: string;
      return_invoice_number: string;
      refund_type: string;
      refund_amount?: number | null;
    }>;
  }>(methodUrl("portal", "cancel_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({
      schedule_name,
      cancel_reason: cancel_reason.trim(),
      refund_type: opts?.refund_type ?? null,
      refund_amount: opts?.refund_amount ?? null,
    }),
  });
}

export async function deleteFlightSchedule(schedule_name: string) {
  return apiRequest<{ deleted: string }>(methodUrl("portal", "delete_flight_schedule"), {
    method: "POST",
    body: JSON.stringify({ schedule_name }),
  });
}

export interface FlightScheduleFareHistoryRow {
  changed_at?: string | null;
  changed_by?: string;
  previous_adult?: number;
  previous_child?: number;
  previous_infant?: number;
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

export interface ArrivalEstimate {
  arrival_date?: string;
  arrival_time?: string;
  total_duration_seconds?: number | null;
  segments?: Array<{
    segment_index: number;
    origin_airport: string;
    destination_airport: string;
    duration?: number | null;
    arrival_date?: string | null;
    arrival_time?: string | null;
  }>;
}

export async function estimateArrivalFromRoute(
  route: string,
  departure_date: string,
  departure_time: string,
) {
  return apiRequest<ArrivalEstimate>(
    "/api/method/bilan_sky.bilan_air_booking_system.doctype.flight_schedule.flight_schedule.estimate_arrival_from_route",
    {
      method: "POST",
      body: JSON.stringify({ route, departure_date, departure_time }),
    },
  );
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
