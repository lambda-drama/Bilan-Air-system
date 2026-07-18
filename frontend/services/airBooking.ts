import { normalizeBookingLookup } from "@/lib/booking-reference";
import { apiRequest, methodUrl } from "./apiClient";
import type { BaggagePolicy, BaggageRecord } from "./baggage";
import type { PassengerTicketData } from "@/lib/passenger-ticket";

export interface BookingPassengerInput {
  passenger_name: string;
  id_number?: string;
  date_of_birth?: string;
  passenger_type?: string;
  seat_number?: string;
  phone_number?: string;
  email?: string;
  register_profile?: boolean;
}

export interface CreateBookingData {
  flight_schedule: string;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  passengers: BookingPassengerInput[];
  /** office = desk (no user accounts for travelers); online = public site */
  booking_source?: "office" | "online";
  /** Cabin chosen in search (Economy, Business, First Class) — validates seat selection */
  seat_class?: string;
}

export interface CreateBookingResult {
  reservation_ref: string;
  /** Issued only after payment or agent credit confirmation. */
  pnr?: string | null;
  status: string;
  reservation_status?: string;
  payment_status?: string;
  total_fare: number;
  hold_duration_minutes?: number;
}

/** Booking identifier for API calls — reservation ref works before PNR is issued. */
export function bookingLookupRef(result: Pick<CreateBookingResult, "reservation_ref" | "pnr">): string {
  return (result.pnr || "").trim() || (result.reservation_ref || "").trim();
}

export interface BookingDetails {
  /** Internal reservation ID (Air Booking name, e.g. RES-00001). */
  reservation_ref: string;
  /** Customer PNR after confirmation; empty while still Booked. */
  pnr?: string | null;
  public_reference?: string;
  status: string;
  payment_status: string;
  total_fare: number;
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;
  flight_schedule?: string;
  boarding_airport?: string | null;
  deboarding_airport?: string | null;
  boarding_label?: string | null;
  deboarding_label?: string | null;
  passengers: Array<{
    row_name?: string;
    name: string;
    passenger?: string;
    id_number?: string;
    type: string;
    seat: string;
    seat_label?: string;
    seat_class?: string;
    baggage_policy?: import("./baggage").BaggagePolicy;
    ticket_number?: string;
    check_in_status?: string;
    can_print_ticket?: boolean;
  }>;
  flight: {
    flight_number: string;
    schedule_id?: string;
    route?: string;
    origin: string;
    destination: string;
    origin_code?: string;
    destination_code?: string;
    origin_label?: string;
    destination_label?: string;
    departure_date: string;
    departure_time: string;
    arrival_date?: string;
    arrival_time?: string;
    status?: string;
    is_active?: number | boolean;
    only_prepayment?: number | boolean;
  };
  baggage?: BaggageRecord[];
  baggage_policy?: BaggagePolicy;
  baggage_fees_total?: number;
  reason_for_cancel?: string | null;
}

export async function createBooking(booking_data: CreateBookingData): Promise<CreateBookingResult> {
  return apiRequest(methodUrl("air_booking", "create_booking"), {
    method: "POST",
    body: JSON.stringify({ booking_data }),
  });
}

export async function fetchBookingDetails(identifier: string): Promise<BookingDetails> {
  return apiRequest(methodUrl("air_booking", "fetch_booking_details"), {
    method: "POST",
    body: JSON.stringify({ pnr: normalizeBookingLookup(identifier) }),
  });
}

export async function getPassengerTicketPrintData(params: {
  pnr: string;
  passenger_row?: string;
  passenger_index?: number;
}): Promise<{
  reservation_ref: string;
  pnr: string;
  passenger_row: string;
  ticket: PassengerTicketData;
}> {
  return apiRequest(methodUrl("air_booking", "get_passenger_ticket_print_data"), {
    method: "POST",
    body: JSON.stringify({
      pnr: params.pnr,
      passenger_row: params.passenger_row || undefined,
      passenger_index: params.passenger_index ?? undefined,
    }),
  });
}

export async function cancelBooking(
  pnr: string,
  reason_for_cancel: string,
  opts?: {
    refund_type?: "full" | "partial";
    refund_amount?: number;
  },
) {
  return apiRequest<{
    success: boolean;
    reservation_ref: string;
    pnr?: string | null;
    status: string;
    refund?: {
      return_invoice: string;
      return_invoice_number: string;
      refund_payment_entry?: string;
      refund_type: string;
      refund_amount?: number | null;
    } | null;
  }>(methodUrl("air_booking", "cancel_booking"), {
    method: "POST",
    body: JSON.stringify({
      pnr,
      reason_for_cancel: reason_for_cancel.trim(),
      refund_type: opts?.refund_type ?? null,
      refund_amount: opts?.refund_amount ?? null,
    }),
  });
}

export async function processPayment(
  pnr: string,
  payment_method: string,
  transaction_id?: string,
) {
  return apiRequest(methodUrl("air_booking", "process_payment"), {
    method: "POST",
    body: JSON.stringify({ pnr, payment_method, transaction_id: transaction_id || null }),
  });
}

export async function createSalesInvoice(pnr: string, submit = 1) {
  return apiRequest(methodUrl("air_booking", "create_sales_invoice_from_booking"), {
    method: "POST",
    body: JSON.stringify({ pnr, submit }),
  });
}

export type PaymentModeOption = {
  name: string;
  default_account?: string | null;
  type?: string;
};

export type PaymentConfirmationOptions = {
  remote: boolean;
  company?: string | null;
  site_url?: string | null;
  default_mode_of_payment?: string | null;
  modes_of_payment: PaymentModeOption[];
};

export async function getPaymentConfirmationOptions(): Promise<PaymentConfirmationOptions> {
  return apiRequest(methodUrl("air_booking", "get_payment_confirmation_options"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function confirmPaymentAndInvoice(pnr: string, payment_method?: string) {
  return apiRequest(methodUrl("air_booking", "confirm_payment_and_invoice_from_booking"), {
    method: "POST",
    body: JSON.stringify({
      pnr,
      payment_method: payment_method || null,
    }),
  });
}

export type ConfirmOnCreditResult = {
  success: boolean;
  pnr: string;
  reservation_ref?: string;
  already_confirmed?: boolean;
  invoice?: string;
  payment_entry?: string;
};

/** Issue PNR and tickets using agent credit (reservation ref or PNR). */
export async function confirmBookingOnCredit(bookingRef: string): Promise<ConfirmOnCreditResult> {
  return apiRequest(methodUrl("air_booking", "confirm_booking_on_credit"), {
    method: "POST",
    body: JSON.stringify({ pnr: bookingRef }),
  });
}

export type BookingJourneyOptions = {
  flight_schedule: string;
  boarding_airport?: string | null;
  deboarding_airport?: string | null;
  is_multi_segment?: boolean;
  airports: Array<{ value: string; label: string }>;
  segments?: Array<Record<string, unknown>>;
};

export async function getBookingJourneyOptions(pnr: string): Promise<BookingJourneyOptions> {
  return apiRequest(methodUrl("air_booking", "get_booking_journey_options"), {
    method: "POST",
    body: JSON.stringify({ pnr: normalizeBookingLookup(pnr) }),
  });
}

export async function updateBookingJourney(params: {
  pnr: string;
  boarding_airport: string;
  deboarding_airport: string;
}) {
  return apiRequest<{
    reservation_ref: string;
    pnr?: string | null;
    boarding_airport: string;
    deboarding_airport: string;
    total_fare?: number;
    changed: boolean;
    seat_warnings?: string[];
    booking: BookingDetails;
  }>(methodUrl("air_booking", "update_booking_journey"), {
    method: "POST",
    body: JSON.stringify({
      pnr: normalizeBookingLookup(params.pnr),
      boarding_airport: params.boarding_airport,
      deboarding_airport: params.deboarding_airport,
    }),
  });
}

export async function changeBookingFlight(params: {
  pnr: string;
  flight_schedule: string;
  boarding_airport?: string;
  deboarding_airport?: string;
}) {
  return apiRequest<{
    reservation_ref: string;
    pnr?: string | null;
    flight_schedule: string;
    boarding_airport: string;
    deboarding_airport: string;
    total_fare?: number;
    flight_number?: string;
    route?: string;
    booking: BookingDetails;
  }>(methodUrl("air_booking", "change_booking_flight"), {
    method: "POST",
    body: JSON.stringify({
      pnr: normalizeBookingLookup(params.pnr),
      flight_schedule: params.flight_schedule,
      boarding_airport: params.boarding_airport || null,
      deboarding_airport: params.deboarding_airport || null,
    }),
  });
}

export async function checkInPassenger(
  pnr: string,
  passenger_index: number,
  baggage_weight?: number,
) {
  return apiRequest(methodUrl("air_booking", "process_check_in"), {
    method: "POST",
    body: JSON.stringify({
      pnr,
      passenger_index,
      baggage_weight: baggage_weight && baggage_weight > 0 ? baggage_weight : 0,
    }),
  });
}

export async function checkInAllPassengers(pnr: string) {
  return apiRequest(methodUrl("air_booking", "check_in_all_passengers"), {
    method: "POST",
    body: JSON.stringify({ pnr }),
  });
}
