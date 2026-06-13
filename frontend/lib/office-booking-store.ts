import type { PassengerSearchCounts } from "@/lib/passenger-search-counts";
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
  /** Fare class code sold (e.g. L, Y). */
  seatClass: string;
  /** Cabin name for seat map (Economy, Business, …). */
  cabinClass?: string;
  passengerCount: number;
  passengerCounts?: PassengerSearchCounts;
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
  /** Flight requires payment before confirmation. */
  onlyPrepayment?: boolean;
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
    cabinClass?: string;
    passengerCount: number;
    passengerCounts?: PassengerSearchCounts;
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
    cabinClass: opts.cabinClass,
    passengerCount: opts.passengerCount,
    passengerCounts: opts.passengerCounts,
    selectedSeatIds: [],
    origin: opts.origin,
    destination: opts.destination,
    departureDate: opts.departureDate,
    route: opts.route || flight.route,
    prices: flight.prices,
  };
}
