import { apiRequest, methodUrl } from "./apiClient";
import type { PortalPermissionsMap, AgentReportPermissions } from "@/lib/portal-permissions";

export interface PortalPermissionsResponse {
  has_full_access: boolean;
  permissions: PortalPermissionsMap;
  agent_reports?: AgentReportPermissions;
}

export async function fetchPortalPermissions(): Promise<
  PortalPermissionsResponse | PortalPermissionsMap
> {
  return apiRequest<PortalPermissionsResponse | PortalPermissionsMap>(
    methodUrl("website_auth", "get_portal_permissions"),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function normalizePortalPermissionsResponse(
  data: PortalPermissionsResponse | PortalPermissionsMap,
): PortalPermissionsResponse {
  if (data && typeof data === "object" && "permissions" in data) {
    return data as PortalPermissionsResponse;
  }
  return {
    has_full_access: false,
    permissions: data as PortalPermissionsMap,
    agent_reports: undefined,
  };
}
