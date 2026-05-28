import { apiRequest, methodUrl } from "./apiClient";

export interface PublicBookingSettings {
  hold_duration_minutes: number;
  hold_duration_hours?: number;
  hold_label: string;
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
  mobile_no?: string;
}) {
  return apiRequest<{ user: string; full_name: string; email: string }>(
    methodUrl("website_auth", "register_website_user"),
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}
