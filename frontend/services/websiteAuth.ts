import { apiRequest, methodUrl } from "./apiClient";

export interface PublicBookingSettings {
  hold_duration_minutes: number;
  hold_duration_hours?: number;
  hold_label: string;
}

export interface WebsiteAccountProfile {
  user: string;
  full_name: string;
  email: string;
  mobile_no: string;
  passenger?: {
    name: string;
    full_name: string;
    id_number?: string;
    phone_number?: string;
    email?: string;
    date_of_birth?: string;
  } | null;
  booking_count: number;
}

export interface MyBookingRow {
  name: string;
  pnr: string;
  flight_schedule: string;
  flight_number?: string;
  route_name?: string;
  departure_date?: string;
  departure_time?: string;
  passenger_name?: string;
  seat?: string;
  seat_class?: string;
  fare_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  payer_name?: string;
  payer_email?: string;
  payer_phone?: string;
}

export async function getPublicBookingSettings(): Promise<PublicBookingSettings> {
  return apiRequest(methodUrl("website_auth", "get_public_booking_settings"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function registerWebsiteUser(data: {
  full_name: string;
  email: string;
  password: string;
  mobile_no: string;
  id_number?: string;
  date_of_birth: string;
}) {
  return apiRequest<{ user: string; full_name: string; email: string; passenger: string }>(
    methodUrl("website_auth", "register_website_user"),
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getMyAccount(): Promise<WebsiteAccountProfile> {
  return apiRequest(methodUrl("website_auth", "get_my_account"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listMyBookings(limit = 50, offset = 0) {
  return apiRequest<{ data: MyBookingRow[]; total: number }>(
    methodUrl("website_auth", "list_my_bookings"),
    {
      method: "POST",
      body: JSON.stringify({ limit, offset }),
    },
  );
}
