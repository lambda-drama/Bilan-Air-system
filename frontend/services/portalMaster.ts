import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

const master = (method: string) => methodUrl("portal_master", method);

export async function listAirports(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_airports"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function saveAirport(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_airport"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listAirlines(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_airlines"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function saveAirline(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_airline"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listAirplanes(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
}) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_airplanes"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
      status: opts?.status ?? null,
    }),
  });
}

export async function getAirplane(name: string) {
  return apiRequest<Record<string, unknown> & { seat_config?: Record<string, unknown>[] }>(
    master("get_airplane"),
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export async function saveAirplane(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_airplane"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listFlightRoutes(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_flight_routes"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export interface SeatClassRow {
  name: string;
  class_name: string;
  cabin_class?: string;
  use_on_aircraft_layout?: number | boolean;
  price_multiplier?: number;
  color_code?: string;
  is_active?: number | boolean;
  checked_baggage_kg?: number;
  checked_baggage_pieces?: number;
  carry_on_kg?: number;
  carry_on_pieces?: number;
  excess_baggage_fee_per_kg?: number;
  description?: string;
}

export async function listSeatClasses(activeOnly = true, layoutOnly?: boolean) {
  return apiRequest<SeatClassRow[]>(master("list_seat_classes"), {
    method: "POST",
    body: JSON.stringify({
      active_only: activeOnly ? 1 : 0,
      layout_only: layoutOnly === undefined ? null : layoutOnly ? 1 : 0,
    }),
  });
}

export interface CabinClassRow {
  name: string;
  cabin_name: string;
  display_order?: number;
  color_code?: string;
  is_active?: number | boolean;
  checked_baggage_kg?: number;
  checked_baggage_pieces?: number;
  carry_on_kg?: number;
  carry_on_pieces?: number;
  excess_baggage_fee_per_kg?: number;
  description?: string;
}

export async function listCabinClasses(activeOnly = true) {
  return apiRequest<CabinClassRow[]>(master("list_cabin_classes"), {
    method: "POST",
    body: JSON.stringify({ active_only: activeOnly ? 1 : 0 }),
  });
}

export async function saveCabinClass(data: Partial<CabinClassRow> & { cabin_name: string }) {
  return apiRequest<CabinClassRow>(master("save_cabin_class"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function saveSeatClass(data: Partial<SeatClassRow> & { class_name: string }) {
  return apiRequest<SeatClassRow>(master("save_seat_class"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listCurrencies() {
  return apiRequest<Array<{ name: string }>>(master("list_currencies"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listCrewMembersPortal(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  crew_role?: string;
  status?: string;
}) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_crew_members_portal"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
      crew_role: opts?.crew_role ?? null,
      status: opts?.status ?? null,
    }),
  });
}

export async function getCrewMember(name: string) {
  return apiRequest<Record<string, unknown>>(master("get_crew_member"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function saveCrewMember(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_crew_member"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function setCrewMemberStatus(name: string, status: string) {
  return apiRequest<Record<string, unknown>>(master("set_crew_member_status"), {
    method: "POST",
    body: JSON.stringify({ name, status }),
  });
}

export type StaffUserRow = {
  name: string;
  email: string;
  full_name: string;
  mobile_no?: string | null;
  enabled?: number | boolean;
  role_profile_name?: string | null;
  user_type?: string | null;
  last_login?: string | null;
};

export async function listStaffUsersPortal(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<StaffUserRow>>(master("list_staff_users_portal"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function createStaffUser(data: {
  email: string;
  full_name: string;
  role_profile_name: string;
  password: string;
  mobile_no?: string;
  enabled?: boolean | number;
}) {
  return apiRequest<StaffUserRow>(master("create_staff_user"), {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function saveStaffUser(data: {
  name: string;
  full_name: string;
  role_profile_name: string;
  mobile_no?: string;
  enabled?: boolean | number;
}) {
  return apiRequest<StaffUserRow>(master("save_staff_user"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listBookingAgents(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_booking_agents"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function listTicketTerms(opts?: { limit?: number; offset?: number; search?: string }) {
  return apiRequest<PaginatedResponse<Record<string, unknown>>>(master("list_ticket_terms"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function saveTicketTerms(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_ticket_terms"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function deleteTicketTerms(name: string) {
  return apiRequest<{ success: boolean; name: string }>(master("delete_ticket_terms"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type BookingCompanyRow = {
  name: string;
  company_agency: string;
  is_agency: number;
  label?: string;
};

export async function listBookingCompanies(opts?: { limit?: number; search?: string }) {
  return apiRequest<PaginatedResponse<BookingCompanyRow>>(master("list_booking_companies"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 200,
      offset: 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function createBookingCompany(params: {
  company_agency: string;
  is_agency?: boolean | number;
}) {
  return apiRequest<BookingCompanyRow>(master("create_booking_company"), {
    method: "POST",
    body: JSON.stringify({
      company_agency: params.company_agency,
      is_agency: params.is_agency ? 1 : 0,
    }),
  });
}

export async function getBookingAgentDefaults() {
  return apiRequest<{
    status: string;
    user_type: string;
    can_book_ticket: string;
    can_confirm_ticket: string;
    deposit_required: string;
    credit_limit: number;
    send_booking_agent_activation_email?: number;
    default_country?: string;
    cities?: string[];
  }>(master("get_booking_agent_defaults"), { method: "POST", body: JSON.stringify({}) });
}

export async function createBookingAgent(params: {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  booking_company: string;
  agent_name?: string;
  address_line1: string;
  city: string;
  phone: string;
  address_line2?: string;
  phone_2?: string;
  country?: string;
  password?: string;
  status?: "Active" | "Inactive";
  user_type?: string;
  can_book_ticket?: "Yes" | "No";
  can_confirm_ticket?: "Yes" | "No";
  deposit_required?: "Yes" | "No";
  credit_limit?: number;
  linked_customer?: string;
  notes?: string;
  role_profile_name?: string;
}) {
  return apiRequest<Record<string, unknown>>(master("create_booking_agent"), {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getBookingAgent(name: string) {
  return apiRequest<Record<string, unknown>>(master("get_booking_agent"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function resendBookingAgentActivation(opts: {
  booking_agent?: string;
  user?: string;
}) {
  return apiRequest<{ success: boolean; user: string }>(
    master("resend_booking_agent_activation"),
    {
      method: "POST",
      body: JSON.stringify({
        booking_agent: opts.booking_agent ?? null,
        user: opts.user ?? null,
      }),
    },
  );
}

export async function saveBookingAgent(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(master("save_booking_agent"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function deleteBookingAgent(name: string) {
  return apiRequest<{ deleted: string }>(master("delete_booking_agent"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type PermissionRoleRow = {
  name: string;
  role_name: string;
  desk_access?: number | boolean;
  disabled?: number | boolean;
  is_custom?: number | boolean;
};

export async function listPermissionRoles() {
  return apiRequest<PermissionRoleRow[]>(master("list_permission_roles"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function savePermissionRole(data: {
  role_name: string;
  desk_access?: boolean | number;
  disabled?: boolean | number;
  two_factor_auth?: boolean | number;
}) {
  return apiRequest<PermissionRoleRow>(master("save_permission_role"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export type RoleProfileRow = {
  name: string;
  role_profile: string;
  roles: string[];
  modified?: string;
  modified_by?: string;
};

export async function listRoleProfilesPortal() {
  return apiRequest<RoleProfileRow[]>(master("list_role_profiles_portal"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function saveRoleProfilePortal(data: {
  name?: string;
  role_profile: string;
  roles: string[];
}) {
  return apiRequest<RoleProfileRow>(master("save_role_profile_portal"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function listRoleProfileOptions() {
  return apiRequest<Array<{ name: string; role_profile: string }>>(master("list_role_profile_options"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
