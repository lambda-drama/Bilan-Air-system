import { apiRequest, ensureCSRF, getCSRF, methodUrl } from "./apiClient";

export type BookingCompanyBranding = {
  name: string;
  company_agency: string;
  is_agency: number;
  logo: string;
  show_logo_on_ticket: number;
  show_logo_on_baggage: number;
  show_logo_on_boarding_pass: number;
};

export async function fetchMyBookingCompanyBranding(): Promise<BookingCompanyBranding | null> {
  return apiRequest<BookingCompanyBranding | null>(
    methodUrl("portal", "get_my_booking_company_branding"),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function updateMyBookingCompanyBranding(data: {
  show_logo_on_ticket?: boolean;
  show_logo_on_baggage?: boolean;
  show_logo_on_boarding_pass?: boolean;
}): Promise<BookingCompanyBranding> {
  return apiRequest<BookingCompanyBranding>(
    methodUrl("portal", "update_my_booking_company_branding"),
    {
      method: "POST",
      body: JSON.stringify({ data }),
    },
  );
}

export async function uploadMyBookingCompanyLogo(file: File): Promise<BookingCompanyBranding> {
  await ensureCSRF();
  const csrf = getCSRF();

  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;

  const response = await fetch(methodUrl("portal", "upload_my_booking_company_logo"), {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  const resData = (await response.json().catch(() => ({}))) as {
    message?: BookingCompanyBranding;
    exc?: string;
    _server_messages?: string;
  };

  if (!response.ok) {
    const msg =
      typeof resData.message === "string"
        ? resData.message
        : "Failed to upload agency logo";
    throw new Error(msg);
  }

  if (!resData.message || typeof resData.message !== "object") {
    throw new Error("Upload did not return branding data");
  }
  return resData.message;
}
