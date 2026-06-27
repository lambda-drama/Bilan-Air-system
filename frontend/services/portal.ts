import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";
import { DEFAULT_PORTAL_LIST_PAGE_SIZE } from "@/lib/portal-list-pagination";

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
  booking_date_display?: string;
  booking_agent?: string;
  agent_name?: string;
  agent_first_name?: string;
  agency_company?: string;
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
      limit: opts?.limit ?? DEFAULT_PORTAL_LIST_PAGE_SIZE,
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
  invoice_number?: string;
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
  invoice_number?: string;
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
        limit: opts?.limit ?? DEFAULT_PORTAL_LIST_PAGE_SIZE,
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

export async function listPaymentBookings(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<AirBookingRow>>(
    methodUrl("portal", "list_payment_bookings"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? DEFAULT_PORTAL_LIST_PAGE_SIZE,
        offset: opts?.offset ?? 0,
        search: opts?.search ?? null,
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

export interface ManifestReportRow {
  pnr_number: string;
  passenger_name: string;
  class: string;
  agent: string;
  agent_first_name?: string;
  agency_company: string;
  passport_number: string;
  origin: string;
  destination: string;
  phone: string;
  reservation_date: string;
  status: string;
}

export async function listReportFlightNumbers(search?: string, limit = 200) {
  return apiRequest<string[]>(methodUrl("portal", "list_report_flight_numbers"), {
    method: "POST",
    body: JSON.stringify({
      search: search?.trim() || null,
      limit,
    }),
  });
}

export async function getManifestDepartureTimes(flightNumber: string, departureDate: string) {
  return apiRequest<string[]>(methodUrl("portal", "get_manifest_departure_times"), {
    method: "POST",
    body: JSON.stringify({
      flight_number: flightNumber.trim(),
      departure_date: departureDate,
    }),
  });
}

export async function getManifestReport(params: {
  flight_number: string;
  departure_date: string;
  departure_time?: string;
  destination?: string;
}) {
  return apiRequest<{
    data: ManifestReportRow[];
    total: number;
    flight_number: string;
    departure_date: string;
  }>(methodUrl("portal", "get_manifest_report"), {
    method: "POST",
    body: JSON.stringify({
      flight_number: params.flight_number.trim(),
      departure_date: params.departure_date,
      departure_time: params.departure_time?.trim() || null,
      destination: params.destination?.trim() || null,
    }),
  });
}

export interface NoShowReportRow {
  flight_no: string;
  departure_date: string;
  pnr_number: string;
  passenger_name: string;
  ticket_type: string;
  agent: string;
  passport_number: string;
  destination: string;
  phone: string;
  status: string;
}

export async function getNoShowReport(params: {
  flight_number: string;
  departure_date: string;
  departure_time?: string;
  destination?: string;
}) {
  return apiRequest<{
    data: NoShowReportRow[];
    total: number;
    flight_number: string;
    departure_date: string;
  }>(methodUrl("portal", "get_no_show_report"), {
    method: "POST",
    body: JSON.stringify({
      flight_number: params.flight_number.trim(),
      departure_date: params.departure_date,
      departure_time: params.departure_time?.trim() || null,
      destination: params.destination?.trim() || null,
    }),
  });
}
