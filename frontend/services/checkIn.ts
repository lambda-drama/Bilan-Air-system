import { apiRequest, methodUrl } from "./apiClient";
import type { BookingDetails } from "./airBooking";

export interface CheckInWindow {
  open: boolean;
  opens_at: string;
  closes_at: string;
  departure_at: string;
}

export interface CheckInBooking extends BookingDetails {
  check_in_window: CheckInWindow;
  can_check_in: boolean;
  all_checked_in: boolean;
  flight: BookingDetails["flight"] & {
    origin_code?: string;
    destination_code?: string;
    origin_label?: string;
    destination_label?: string;
    arrival_date?: string;
    arrival_time?: string;
    status?: string;
  };
  baggage_policy?: BookingDetails["baggage_policy"] & { carry_on_kg?: number };
}

export interface BoardingPass {
  passenger_name: string;
  ticket_number?: string;
  seat: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  origin_label?: string;
  destination_label?: string;
  departure_date: string;
  departure_time: string;
  boarding_time: string;
  gate: string;
  pnr: string;
}

export interface SelfCheckInResult {
  success: boolean;
  message: string;
  booking: CheckInBooking;
  boarding_passes: BoardingPass[];
}

export async function lookupBookingForCheckin(pnr: string, lastName?: string) {
  return apiRequest<CheckInBooking>(methodUrl("air_booking", "lookup_booking_for_checkin"), {
    method: "POST",
    body: JSON.stringify({
      pnr: pnr.trim(),
      last_name: lastName?.trim() || undefined,
    }),
  });
}

export async function selfCheckInAll(pnr: string, lastName?: string) {
  return apiRequest<SelfCheckInResult>(methodUrl("air_booking", "self_check_in_all"), {
    method: "POST",
    body: JSON.stringify({
      pnr: pnr.trim(),
      last_name: lastName?.trim() || undefined,
    }),
  });
}
