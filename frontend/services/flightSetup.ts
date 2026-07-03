import { apiRequest, methodUrl } from "./apiClient";

export interface FlightSetupDetail {
  flight_number: string;
  route: string;
  route_label?: string | null;
  origin_label?: string | null;
  destination_label?: string | null;
  airplane: string;
  terms_and_conditions?: string;
  is_active?: number | boolean;
  has_master?: number | boolean;
  modified?: string;
  modified_by?: string;
  flight_prices?: FlightSetupPriceRow[];
  flight_penalties?: FlightSetupPenaltyRow[];
  price_count?: number;
  penalty_count?: number;
}

export interface FlightSetupPriceRow {
  name?: string;
  seat_class: string;
  passenger_type: string;
  tax_group_name?: string;
  surcharge_group_name?: string;
  fare: number;
  non_base_agent_commission?: number;
  base_agent_commission?: number;
  baggage_pieces?: number;
  baggage_weight_kg?: number;
  hand_carry_pieces?: number;
  hand_carry_weight_kg?: number;
}

export interface FlightSetupPenaltyRow {
  name?: string;
  penalty_type: string;
  amount: number;
  applies_when?: string;
  route?: string;
  flight_schedule?: string;
  description?: string;
}

export interface SeatClassOption {
  name: string;
  class_name: string;
  cabin_class?: string;
  cabin_name?: string;
  label?: string;
  is_active?: number | boolean;
}

export async function listSeatClassOptions(forPricing = true): Promise<SeatClassOption[]> {
  return apiRequest<SeatClassOption[]>(methodUrl("portal", "list_seat_class_options"), {
    method: "POST",
    body: JSON.stringify({ for_pricing: forPricing ? 1 : 0 }),
  });
}

export function flightSetupPath(
  flightNumber: string,
  sub?: "schedules" | "plans" | "pricing" | "penalties",
): string {
  const q = `flight_number=${encodeURIComponent(flightNumber)}`;
  if (sub === "plans") return `/portal/flights/setup/plans?${q}`;
  if (sub === "schedules") return `/portal/flights/setup/schedules?${q}`;
  if (sub === "pricing") return `/portal/flights/setup/pricing?${q}`;
  if (sub === "penalties") return `/portal/flights/setup/penalties?${q}`;
  return `/portal/flights/setup?${q}`;
}

export interface FlightSetupMasterRow {
  flight_number: string;
  route: string;
  airplane: string;
  route_label?: string | null;
  origin_label?: string | null;
  destination_label?: string | null;
  airplane_label?: string | null;
  is_active?: number | boolean;
  has_master?: number | boolean;
}

export async function listFlightSetupMasters(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}) {
  return apiRequest<{ data: FlightSetupMasterRow[]; total: number }>(
    methodUrl("portal", "list_flight_setup_masters"),
    {
      method: "POST",
      body: JSON.stringify({
        limit: opts?.limit ?? 200,
        offset: opts?.offset ?? 0,
        search: opts?.search ?? null,
      }),
    },
  );
}

export async function getFlightSetup(flightNumber: string): Promise<FlightSetupDetail> {
  return apiRequest(methodUrl("portal", "get_flight_setup"), {
    method: "POST",
    body: JSON.stringify({ flight_number: flightNumber }),
  });
}

export async function saveFlightSetup(data: {
  flight_number: string;
  route: string;
  airplane: string;
  terms_and_conditions?: string;
  is_active?: boolean | number;
  flight_prices?: FlightSetupPriceRow[];
  flight_penalties?: FlightSetupPenaltyRow[];
}): Promise<FlightSetupDetail> {
  return apiRequest(methodUrl("portal", "save_flight_setup"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function setFlightSetupActive(
  flightNumber: string,
  isActive: boolean | number,
): Promise<FlightSetupDetail> {
  return apiRequest(methodUrl("portal", "set_flight_setup_active"), {
    method: "POST",
    body: JSON.stringify({
      flight_number: flightNumber,
      is_active: isActive ? 1 : 0,
    }),
  });
}

export async function deleteFlightSetup(flightNumber: string): Promise<{ deleted: string }> {
  return apiRequest(methodUrl("portal", "delete_flight_setup"), {
    method: "POST",
    body: JSON.stringify({ flight_number: flightNumber }),
  });
}

export async function saveFlightSetupPrices(
  flightNumber: string,
  flightPrices: FlightSetupPriceRow[],
): Promise<FlightSetupDetail> {
  return apiRequest(methodUrl("portal", "save_flight_setup_prices"), {
    method: "POST",
    body: JSON.stringify({ flight_number: flightNumber, flight_prices: flightPrices }),
  });
}

export async function saveFlightSetupPenalties(
  flightNumber: string,
  flightPenalties: FlightSetupPenaltyRow[],
): Promise<FlightSetupDetail> {
  return apiRequest(methodUrl("portal", "save_flight_setup_penalties"), {
    method: "POST",
    body: JSON.stringify({ flight_number: flightNumber, flight_penalties: flightPenalties }),
  });
}
