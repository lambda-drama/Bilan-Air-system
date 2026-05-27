import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

export interface AirBookingRow {
  name: string;
  flight_schedule: string;
  payer_name: string;
  payer_email?: string;
  payer_phone?: string;
  booking_status: string;
  payment_status: string;
  total_fare: number;
  booking_date?: string;
  sales_invoice?: string;
  payment_entry?: string;
}

export async function listBookings(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<AirBookingRow>>(methodUrl("portal", "list_air_bookings"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
      status: opts?.status ?? null,
      search: opts?.search ?? null,
    }),
  });
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
