import { apiRequest, methodUrl } from "./apiClient";

export async function listCountries(): Promise<{ name: string }[]> {
  return apiRequest(methodUrl("portal", "list_countries"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listCrewMembers(opts?: {
  crew_role?: string;
  for_date?: string;
}): Promise<{ name: string; full_name: string; crew_role: string; employee_id?: string }[]> {
  return apiRequest(methodUrl("portal", "list_crew_members"), {
    method: "POST",
    body: JSON.stringify({
      crew_role: opts?.crew_role ?? null,
      for_date: opts?.for_date ?? null,
    }),
  });
}

export async function listCrewRoles(category?: string): Promise<
  { name: string; role_name: string; category: string }[]
> {
  return apiRequest(methodUrl("portal", "list_crew_roles"), {
    method: "POST",
    body: JSON.stringify({ category: category ?? null }),
  });
}
