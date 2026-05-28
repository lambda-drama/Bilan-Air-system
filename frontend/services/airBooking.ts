import { apiRequest, methodUrl } from "./apiClient";
import type { BaggagePolicy, BaggageRecord } from "./baggage";

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
}

export interface CreateBookingResult {
  pnr: string;
  status: string;
  payment_status?: string;
  total_fare: number;
  hold_duration_minutes?: number;
}

export interface BookingDetails {
  pnr: string;
  status: string;
  payment_status: string;
  total_fare: number;
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;
  passengers: Array<{
    name: string;
    passenger?: string;
    id_number?: string;
    type: string;
    seat: string;
    seat_label?: string;
    ticket_number?: string;
    check_in_status?: string;
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

export async function cancelBooking(pnr: string) {
  return apiRequest(methodUrl("air_booking", "cancel_booking"), {
    method: "POST",
    body: JSON.stringify({ pnr }),
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

export async function confirmPaymentAndInvoice(pnr: string, payment_method?: string) {
  return apiRequest(methodUrl("air_booking", "confirm_payment_and_invoice_from_booking"), {
    method: "POST",
    body: JSON.stringify({ pnr, payment_method: payment_method || null }),
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
