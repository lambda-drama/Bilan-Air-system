import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

export interface PassengerData {
  full_name: string;
  id_number?: string;
  date_of_birth: string;
  passenger_type: string;
  phone_number: string;
  email: string;
  nationality?: string;
  notes?: string;
  is_active?: number;
}

export interface PassengerRecord extends PassengerData {
  name: string;
  is_active?: number;
  notes?: string;
}

export async function registerPassenger(passenger_data: PassengerData) {
  return apiRequest(methodUrl("passenger", "register_passenger"), {
    method: "POST",
    body: JSON.stringify({ passenger_data }),
  });
}

export async function lookupPassengerById(id_number: string) {
  return apiRequest<PassengerRecord | null>(methodUrl("passenger", "lookup_passenger_by_id"), {
    method: "POST",
    body: JSON.stringify({ id_number }),
  });
}

export async function listPassengers(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<PassengerRecord>>(methodUrl("portal", "list_passengers"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
      search: opts?.search ?? null,
    }),
  });
}
