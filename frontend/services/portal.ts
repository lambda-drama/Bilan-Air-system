import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

export interface AirBookingRow {
  name: string;
  pnr?: string | null;
  flight_schedule: string;
  payer_name: string;
  payer_email?: string;
  payer_phone?: string;
  reservation_status?: string;
  booking_status: string;
  payment_status: string;
  total_fare: number;
  booking_date?: string;
  sales_invoice?: string;
  payment_entry?: string;
}

export interface CheckInBookingSuggestion {
  pnr?: string | null;
  reservation_ref: string;
  public_reference?: string;
  payer_name: string;
  payer_phone?: string;
  payer_email?: string;
  flight_schedule: string;
  flight_number?: string;
  departure_date?: string;
  departure_time?: string;
  reservation_status?: string;
  booking_status: string;
  payment_status: string;
}

export async function searchBookingsForCheckin(query?: string, limit = 15) {
  return apiRequest<CheckInBookingSuggestion[]>(
    methodUrl("portal", "search_bookings_for_checkin"),
    {
      method: "POST",
      body: JSON.stringify({ query: query?.trim() || null, limit }),
    },
  );
}

export async function listBookings(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  payment_status?: string;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<AirBookingRow>>(methodUrl("portal", "list_air_bookings"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
      status: opts?.status ?? null,
      payment_status: opts?.payment_status ?? null,
      search: opts?.search ?? null,
    }),
  });
}

export interface PassengerTicketRow {
  passenger_row: string;
  passenger_name: string;
  ticket_number: string;
  seat_number?: string;
  seat_label?: string;
  passenger_type: string;
  reservation_ref: string;
  pnr?: string | null;
  flight_schedule: string;
  flight_number?: string;
  departure_date?: string | null;
  booking_date?: string;
}

export async function listPassengerTickets(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<PassengerTicketRow>>(
    methodUrl("portal", "list_passenger_tickets"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
        search: opts?.search ?? null,
      }),
    },
  );
}

export interface BookingInvoiceRow {
  name: string;
  invoice_type?: string;
  booking_pnr: string;
  payer_name?: string;
  payment_status?: string;
  booking_status?: string;
  payment_entry?: string;
  customer?: string;
  posting_date?: string;
  due_date?: string;
  grand_total?: number;
  outstanding_amount?: number;
  invoice_status?: string;
  currency?: string;
  docstatus?: number;
}

export interface BookingInvoiceDetail {
  name: string;
  invoice_type?: string;
  booking_pnr?: string;
  customer?: string;
  posting_date?: string;
  due_date?: string;
  grand_total?: number;
  outstanding_amount?: number;
  status?: string;
  currency?: string;
  docstatus?: number;
  remarks?: string;
  booking?: {
    name: string;
    payer_name?: string;
    payer_email?: string;
    payer_phone?: string;
    payment_status?: string;
    booking_status?: string;
    total_fare?: number;
    payment_entry?: string;
    flight_schedule?: string;
  };
}

export async function listBookingInvoices(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<BookingInvoiceRow>>(
    methodUrl("portal", "list_booking_invoices"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
        search: opts?.search ?? null,
      }),
    },
  );
}

export async function getBookingInvoiceDetail(invoiceName: string) {
  return apiRequest<BookingInvoiceDetail>(methodUrl("portal", "get_booking_invoice_detail"), {
    method: "POST",
    body: JSON.stringify({ invoice_name: invoiceName }),
  });
}

export async function listPaymentBookings(opts?: { limit?: number; offset?: number }) {
  return apiRequest<PaginatedResponse<AirBookingRow>>(
    methodUrl("portal", "list_payment_bookings"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
      }),
    },
  );
}

export async function getDashboardStats() {
  return apiRequest<{
    total_bookings: number;
    pending_payments: number;
    upcoming_flights: number;
    available_seats: number;
  }>(methodUrl("portal", "get_dashboard_stats"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface PortalReportsMonthlyRow {
  month: string;
  month_num: number;
  bookings: number;
  revenue: number;
}

export interface PortalReportsTopRoute {
  route: string;
  bookings: number;
  revenue: number;
}

export interface PortalReportsData {
  year: number;
  available_years: number[];
  summary: {
    total_revenue: number;
    total_bookings: number;
    total_passengers: number;
    flights_operated: number;
  };
  yoy: {
    total_revenue: number | null;
    total_bookings: number | null;
    total_passengers: number | null;
    flights_operated: number | null;
  };
  monthly: PortalReportsMonthlyRow[];
  top_routes: PortalReportsTopRoute[];
}

export async function getPortalReports(year?: number) {
  return apiRequest<PortalReportsData>(
    methodUrl("portal", "get_portal_reports"),
    {
      method: "POST",
      body: JSON.stringify({ year: year ?? null }),
    },
  );
}
