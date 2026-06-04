import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

const planApi = (method: string) =>
  methodUrl("flight_schedule_plan", method);

export type FlightSchedulePlanRow = {
  name: string;
  plan_title: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  start_date: string;
  end_date: string;
  route: string;
  airplane: string;
  plan_status?: string;
  generated_count?: number;
};

export async function listFlightSchedulePlans(opts?: {
  limit?: number;
  search?: string;
}) {
  return apiRequest<PaginatedResponse<FlightSchedulePlanRow>>(planApi("list_flight_schedule_plans"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: 0,
      search: opts?.search ?? null,
    }),
  });
}

export async function saveFlightSchedulePlan(data: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>(planApi("save_flight_schedule_plan"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function previewPlanOccurrences(data: Record<string, unknown>) {
  return apiRequest<{ count: number }>(planApi("preview_plan_occurrences"), {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export async function generatePlanSchedules(planName: string, submit = 1) {
  return apiRequest<{
    created_count: number;
    skipped_count: number;
    created: Array<{ name: string; departure_date: string }>;
    skipped: Array<{ departure_date: string; reason: string }>;
  }>(planApi("generate_plan_schedules"), {
    method: "POST",
    body: JSON.stringify({ plan_name: planName, submit }),
  });
}
