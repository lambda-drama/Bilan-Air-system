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

export async function listSeatClasses() {
  return apiRequest<Array<{ name: string; class_name: string }>>(master("list_seat_classes"), {
    method: "POST",
    body: JSON.stringify({}),
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

export async function createBookingAgent(params: {
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  password?: string;
}) {
  return apiRequest<Record<string, unknown>>(master("create_booking_agent"), {
    method: "POST",
    body: JSON.stringify(params),
  });
}
