import { apiRequest, methodUrl } from "./apiClient";

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
}

export interface CreateBookingResult {
  pnr: string;
  status: string;
  total_fare: number;
}

export interface BookingDetails {
  pnr: string;
  status: string;
  payment_status: string;
  total_fare: number;
  passengers: Array<{
    name: string;
    passenger?: string;
    id_number?: string;
    type: string;
    seat: string;
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

export async function confirmPaymentAndInvoice(pnr: string) {
  return apiRequest(methodUrl("air_booking", "confirm_payment_and_invoice_from_booking"), {
    method: "POST",
    body: JSON.stringify({ pnr }),
  });
}
