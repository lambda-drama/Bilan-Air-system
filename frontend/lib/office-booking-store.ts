import type { FlightSearchResult } from "@/services/search";

export interface OfficeBookingPassengerDraft {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string;
  passenger_type: string;
}

export interface OfficeBookingDraft {
  scheduleId: string;
  flightNumber: string;
  seatClass: string;
  passengerCount: number;
  selectedSeatIds: string[];
  origin?: string;
  destination?: string;
  departureDate?: string;
  route?: string;
  prices?: Record<string, number>;
  payer?: {
    name: string;
    email: string;
    phone: string;
  };
  passengers?: OfficeBookingPassengerDraft[];
  markPaid?: boolean;
  /** When true, Traveler 1 name/phone/email mirror the payer. */
  payerIsTraveling?: boolean;
}

const KEY = "bilan_office_booking_draft";

export function saveOfficeBookingDraft(draft: OfficeBookingDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadOfficeBookingDraft(): OfficeBookingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OfficeBookingDraft;
  } catch {
    return null;
  }
}

export function clearOfficeBookingDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function draftFromFlight(
  flight: FlightSearchResult,
  opts: {
    seatClass: string;
    passengerCount: number;
    origin?: string;
    destination?: string;
    departureDate?: string;
    route?: string;
  },
): OfficeBookingDraft {
  return {
    scheduleId: flight.schedule_id,
    flightNumber: flight.flight_number,
    seatClass: opts.seatClass,
    passengerCount: opts.passengerCount,
    selectedSeatIds: [],
    origin: opts.origin,
    destination: opts.destination,
    departureDate: opts.departureDate,
    route: opts.route || flight.route,
    prices: flight.prices,
  };
}
