import { apiRequest, methodUrl } from "./apiClient";
import type { PaginatedResponse } from "@/types/bilan";

const planApi = (method: string) =>
  methodUrl("flight_schedule_plan", method);

export type FlightSchedulePlanRow = {
  name: string;
  plan_title: string;
  plan_type?: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  start_date: string;
  end_date: string;
  route: string;
  airplane: string;
  flight_number?: string;
  plan_status?: string;
  departure_time?: string;
  arrival_time?: string;
  status?: string;
  type_label?: string;
  generated_count?: number;
  modified?: string;
  modified_by?: string;
};

/** Open dated departures filtered to schedules generated from this recurring plan. */
export function recurringPlanSchedulesPath(
  plan: Pick<FlightSchedulePlanRow, "name" | "flight_number">,
): string {
  const params = new URLSearchParams({ schedule_plan: plan.name });
  if (plan.flight_number) {
    return `/portal/flights/setup/schedules?${params.toString()}`;
  }
  return `/portal/flights?${params.toString()}`;
}

export async function getFlightSchedulePlanDefaults() {
  return apiRequest<{ suggested_plan_title: string }>(
    planApi("get_flight_schedule_plan_defaults"),
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function getFlightSchedulePlan(name: string) {
  return apiRequest<Record<string, unknown>>(planApi("get_flight_schedule_plan"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function listFlightSchedulePlans(opts?: {
  limit?: number;
  search?: string;
  flight_number?: string;
}) {
  return apiRequest<PaginatedResponse<FlightSchedulePlanRow>>(planApi("list_flight_schedule_plans"), {
    method: "POST",
    body: JSON.stringify({
      limit: opts?.limit ?? 100,
      offset: 0,
      search: opts?.search ?? null,
      flight_number: opts?.flight_number ?? null,
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

export type PlanGenerationStatus = {
  status: "idle" | "running" | "complete" | "failed";
  plan?: string;
  plan_title?: string;
  expected_count?: number;
  processed_count?: number;
  created_count?: number;
  skipped_count?: number;
  message?: string;
};

export type PlanScheduleGenerationResult = {
  queued: boolean;
  plan: string;
  expected_count: number;
};

export async function getPlanGenerationStatus(planName: string) {
  return apiRequest<PlanGenerationStatus>(planApi("get_plan_generation_status"), {
    method: "POST",
    body: JSON.stringify({ plan_name: planName }),
  });
}

export async function generatePlanSchedules(planName: string, submit = 1) {
  return apiRequest<PlanScheduleGenerationResult>(planApi("generate_plan_schedules"), {
    method: "POST",
    body: JSON.stringify({ plan_name: planName, submit }),
  });
}

export async function deleteFlightSchedulePlan(planName: string) {
  return apiRequest<{ deleted: string }>(planApi("delete_flight_schedule_plan"), {
    method: "POST",
    body: JSON.stringify({ plan_name: planName }),
  });
}
