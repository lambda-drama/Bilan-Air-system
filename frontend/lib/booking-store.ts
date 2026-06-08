import type { TripType } from "./trip-types";

export interface BookingPassengerDraft {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string;
  passenger_type: "Adult" | "Child" | "Infant";
}

export interface BookingLegDraft {
  flightScheduleId: string;
  flightNumber?: string;
  seatClass: string;
  selectedSeatIds: string[];
  selectedSeatLabels: string[];
  origin?: string;
  destination?: string;
  departure_date?: string;
  farePerPerson?: number;
}

export interface BookingDraft {
  tripType?: TripType;
  legs?: BookingLegDraft[];
  flightScheduleId: string;
  flightNumber?: string;
  seatClass: string;
  selectedSeatIds: string[];
  selectedSeatLabels: string[];
  passengers: BookingPassengerDraft[];
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  /** When true, Traveler 1 contact fields mirror payer / account. */
  payerIsTraveling?: boolean;
  totalFare?: number;
  origin?: string;
  destination?: string;
  departure_date?: string;
}

const KEY = "bilan_booking_draft";

export function saveBookingDraft(draft: BookingDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadBookingDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function clearBookingDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
