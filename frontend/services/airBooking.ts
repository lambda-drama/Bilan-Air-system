import { apiRequest, methodUrl } from "./apiClient";
import type { BaggagePolicy, BaggageRecord } from "./baggage";
import type { PassengerTicketData } from "@/lib/passenger-ticket";

export interface BookingPassengerInput {
  passenger_name: string;
  id_number: string;
  date_of_birth?: string;
  passenger_type?: string;
  seat_number: string;
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
  pnr: string;
  status: string;
  payment_status?: string;
  total_fare: number;
  hold_duration_minutes?: number;
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
  passengers: Array<{
    row_name?: string;
    name: string;
    passenger?: string;
    id_number?: string;
    type: string;
    seat: string;
    seat_label?: string;
    ticket_number?: string;
    check_in_status?: string;
    can_print_ticket?: boolean;
  }>;
  flight: {
    flight_number: string;
    origin: string;
    destination: string;
    departure_date: string;
    departure_time: string;
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

export async function fetchBookingDetails(pnr: string): Promise<BookingDetails> {
  return apiRequest(methodUrl("air_booking", "fetch_booking_details"), {
    method: "POST",
    body: JSON.stringify({ pnr }),
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

export async function cancelBooking(pnr: string, reason_for_cancel: string) {
  return apiRequest(methodUrl("air_booking", "cancel_booking"), {
    method: "POST",
    body: JSON.stringify({ pnr, reason_for_cancel: reason_for_cancel.trim() }),
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
  default_cash_account?: string | null;
  default_mpesa_account?: string | null;
  modes_of_payment: PaymentModeOption[];
  accounts: { name: string; account_name?: string; account_type?: string }[];
};

export async function getPaymentConfirmationOptions(): Promise<PaymentConfirmationOptions> {
  return apiRequest(methodUrl("air_booking", "get_payment_confirmation_options"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function confirmPaymentAndInvoice(
  pnr: string,
  payment_method?: string,
  paid_account?: string,
) {
  return apiRequest(methodUrl("air_booking", "confirm_payment_and_invoice_from_booking"), {
    method: "POST",
    body: JSON.stringify({
      pnr,
      payment_method: payment_method || null,
      paid_account: paid_account || null,
    }),
  });
}

export type ConfirmOnCreditResult = {
  success: boolean;
  pnr: string;
  reservation_ref?: string;
  already_confirmed?: boolean;
};

/** Issue PNR and tickets using agent credit (reservation ref or PNR). */
export async function confirmBookingOnCredit(bookingRef: string): Promise<ConfirmOnCreditResult> {
  return apiRequest(methodUrl("air_booking", "confirm_booking_on_credit"), {
    method: "POST",
    body: JSON.stringify({ pnr: bookingRef }),
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
