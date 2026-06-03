import { apiRequest, clearCSRF, ensureCSRF, methodUrl } from "./apiClient";

export interface FrappeUser {
  name: string;
  full_name: string;
  email: string;
  user_image?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile_no?: string;
  roles: string[];
}

export async function login(username: string, password: string): Promise<FrappeUser> {
  clearCSRF();

  const response = await fetch("/api/method/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usr: username, pwd: password }),
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Invalid credentials");
  }

  clearCSRF();
  await ensureCSRF(true);
  return getCurrentUserProfile();
}

export async function logout(): Promise<void> {
  try {
    await apiRequest("/api/method/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  clearCSRF();
}

export async function getLoggedUser(): Promise<string | null> {
  try {
    const res = await fetch("/api/method/frappe.auth.get_logged_user", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.message;
    if (!user || user === "Guest") return null;
    return user;
  } catch {
    return null;
  }
}

export async function getCurrentUserProfile(username?: string): Promise<FrappeUser> {
  const resolved = username ?? (await getLoggedUser());
  if (!resolved) throw new Error("Not logged in");

  await ensureCSRF();
  const profile = await apiRequest<{
    name: string;
    full_name: string;
    email: string;
    user_image?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    mobile_no?: string;
    roles: string[];
  }>(methodUrl("website_auth", "get_session_user_profile"), {
    method: "POST",
    body: JSON.stringify({}),
  });

  return {
    name: profile.name || resolved,
    full_name: profile.full_name || profile.name,
    email: profile.email || "",
    user_image: profile.user_image,
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    phone: profile.phone || "",
    mobile_no: profile.mobile_no || "",
    roles: profile.roles || [],
  };
}
