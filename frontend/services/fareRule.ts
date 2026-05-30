import { apiRequest, methodUrl } from "./apiClient";

export interface FareRuleRow {
  name: string;
  route: string;
  route_name?: string;
  origin_airport?: string;
  destination_airport?: string;
  days_before_departure: number;
  price_increase_percentage: number;
  is_active: number | boolean;
  priority: number;
  modified?: string;
}

export interface FareRuleListResult {
  data: FareRuleRow[];
  total: number;
}

export async function listFareRules(params?: {
  limit?: number;
  offset?: number;
  route?: string;
  search?: string;
  activeOnly?: boolean;
}) {
  return apiRequest<FareRuleListResult>(methodUrl("portal", "list_fare_rules"), {
    method: "POST",
    body: JSON.stringify({
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
      route: params?.route || undefined,
      search: params?.search?.trim() || undefined,
      active_only: params?.activeOnly ? 1 : undefined,
    }),
  });
}

export async function saveFareRule(data: Record<string, unknown>) {
  return apiRequest<FareRuleRow>(methodUrl("portal", "save_fare_rule"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function deleteFareRule(name: string) {
  return apiRequest<{ success: boolean; name: string }>(
    methodUrl("portal", "delete_fare_rule"),
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}
