import { normalizeBookingLookup } from "@/lib/booking-reference";
import type { BoardingPassData } from "@/lib/boarding-pass";
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

export type BoardingPass = BoardingPassData;

export interface SelfCheckInResult {
  success: boolean;
  message: string;
  booking: CheckInBooking;
  boarding_passes: BoardingPass[];
}

export async function lookupBookingForCheckin(identifier: string, lastName?: string) {
  return apiRequest<CheckInBooking>(methodUrl("air_booking", "lookup_booking_for_checkin"), {
    method: "POST",
    body: JSON.stringify({
      pnr: normalizeBookingLookup(identifier),
      last_name: lastName?.trim() || undefined,
    }),
  });
}

export async function selfCheckInAll(identifier: string, lastName?: string) {
  return apiRequest<SelfCheckInResult>(methodUrl("air_booking", "self_check_in_all"), {
    method: "POST",
    body: JSON.stringify({
      pnr: normalizeBookingLookup(identifier),
      last_name: lastName?.trim() || undefined,
    }),
  });
}

export async function getBoardingPassPrintData(params: {
  pnr: string;
  passenger_row?: string;
  passenger_index?: number;
}) {
  return apiRequest<{
    reservation_ref: string;
    pnr?: string | null;
    passenger_row: string;
    boarding_pass: BoardingPassData;
  }>(methodUrl("air_booking", "get_boarding_pass_print_data"), {
    method: "POST",
    body: JSON.stringify({
      pnr: normalizeBookingLookup(params.pnr),
      passenger_row: params.passenger_row || undefined,
      passenger_index: params.passenger_index ?? undefined,
    }),
  });
}
