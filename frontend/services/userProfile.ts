import { apiRequest, methodUrl, uploadFile } from "./apiClient";
import type { BookingAgentProfile } from "@/lib/booking-agent-credit";
import type { FrappeUser } from "./auth";
import { getLoggedUser } from "./auth";

export type PortalUserProfile = FrappeUser & {
  first_name: string;
  last_name: string;
  phone: string;
  mobile_no: string;
  booking_agent_profile?: BookingAgentProfile | null;
};

export async function fetchPortalUserProfile(): Promise<PortalUserProfile> {
  return apiRequest(methodUrl("portal", "get_portal_user_profile"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updatePortalUserProfile(data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile_no?: string;
}): Promise<PortalUserProfile> {
  return apiRequest(methodUrl("portal", "update_portal_user_profile"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function uploadUserProfileImage(file: File): Promise<PortalUserProfile> {
  const username = await getLoggedUser();
  if (!username) throw new Error("Not logged in");

  const uploaded = await uploadFile(file, {
    doctype: "User",
    docname: username,
    fieldname: "user_image",
    isPrivate: true,
  });

  const fileUrl = uploaded.file_url;
  if (!fileUrl) throw new Error("Upload did not return a file URL");

  return apiRequest(methodUrl("portal", "set_portal_user_image"), {
    method: "POST",
    body: JSON.stringify({ user_image: fileUrl }),
  });
}

export async function updateUserPassword(
  oldPassword: string,
  newPassword: string,
  logoutAllSessions = false,
): Promise<void> {
  await apiRequest("/api/method/frappe.core.doctype.user.user.update_password", {
    method: "POST",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      logout_all_sessions: logoutAllSessions ? 1 : 0,
    }),
  });
}
