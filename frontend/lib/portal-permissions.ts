/** Frappe permission types exposed to the portal UI. */
export type PortalPermissionType =
  | "read"
  | "select"
  | "write"
  | "create"
  | "delete"
  | "submit"
  | "cancel";

export type DoctypePermissions = Partial<Record<PortalPermissionType, 0 | 1>> & {
  /** Present when read/write/delete apply only to documents the user owns. */
  owner_scoped?: Partial<Record<PortalPermissionType, 0 | 1>>;
};

export type PortalPermissionsMap = Record<string, DoctypePermissions>;

/** Booking-agent report access from BA Settings (System Manager bypasses). */
export type AgentReportKey = "analytics" | "dashboard" | "manifest" | "no_show";

export type AgentReportPermissions = Record<AgentReportKey, 0 | 1>;

export const AGENT_REPORT_ROUTE_KEYS: Array<{ prefix: string; reportKey: AgentReportKey }> = [
  { prefix: "/portal/reports/analytics", reportKey: "analytics" },
  { prefix: "/portal/reports/m-fest", reportKey: "manifest" },
  { prefix: "/portal/reports/no-show", reportKey: "no_show" },
];

export function resolveRouteReportKey(pathname: string): AgentReportKey | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/portal";
  const sorted = [...AGENT_REPORT_ROUTE_KEYS].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, reportKey } of sorted) {
    const normalized = prefix.replace(/\/$/, "");
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      return reportKey;
    }
  }
  return null;
}

export function canViewAgentReport(
  agentReports: AgentReportPermissions | null | undefined,
  reportKey: AgentReportKey | null | undefined,
  hasFullAccess = false,
): boolean {
  if (hasFullAccess || !reportKey) return true;
  if (!agentReports) return false;
  return agentReports[reportKey] === 1;
}

export const DEFAULT_AGENT_REPORT_PERMISSIONS: AgentReportPermissions = {
  analytics: 1,
  dashboard: 1,
  manifest: 1,
  no_show: 1,
};

/** Fail-closed when report flags are not yet loaded from the server. */
export const DENIED_AGENT_REPORT_PERMISSIONS: AgentReportPermissions = {
  analytics: 0,
  dashboard: 0,
  manifest: 0,
  no_show: 0,
};

/** Map portal routes (longest prefix wins) to the doctype that gates access. */
export const PORTAL_ROUTE_DOCTYPES: Array<{ prefix: string; doctype: string | null }> = [
  { prefix: "/portal/flights/setup", doctype: "Flight Setup" },
  { prefix: "/portal/flights/recurring", doctype: "Flight Schedule Plan" },
  { prefix: "/portal/flights", doctype: "Flight Schedule" },
  { prefix: "/portal/seat-inventory", doctype: "Seat Inventory" },
  { prefix: "/portal/booking", doctype: "Air Booking" },
  { prefix: "/portal/bookings", doctype: "Air Booking" },
  { prefix: "/portal/check-in", doctype: "Air Booking" },
  { prefix: "/portal/baggage", doctype: "Baggage Tracking" },
  { prefix: "/portal/passengers", doctype: "Passenger" },
  { prefix: "/portal/direct-messages", doctype: "Website Contact Message" },
  { prefix: "/portal/master/airports", doctype: "Airport" },
  { prefix: "/portal/master/airlines", doctype: "Airline" },
  { prefix: "/portal/master/routes", doctype: "Flight Route" },
  { prefix: "/portal/master/airplanes", doctype: "Airplane" },
  { prefix: "/portal/master/cabin-classes", doctype: "Cabin Class" },
  { prefix: "/portal/master/seat-classes", doctype: "Seat Class" },
  { prefix: "/portal/master/ticket-terms", doctype: "Ticket Terms" },
  { prefix: "/portal/permissions/roles", doctype: "Role" },
  { prefix: "/portal/permissions/role-profiles", doctype: "Role Profile" },
  { prefix: "/portal/users/booking-agents", doctype: "Booking Agent" },
  { prefix: "/portal/users/crew-members", doctype: "Crew Member" },
  { prefix: "/portal/users/staff", doctype: "User" },
  { prefix: "/portal/fare-rules", doctype: "Fare Rule" },
  { prefix: "/portal/invoices", doctype: "Sales Invoice" },
  { prefix: "/portal/payments", doctype: "Payment Entry" },
  { prefix: "/portal/reports/analytics", doctype: "Air Booking" },
  { prefix: "/portal/reports/m-fest", doctype: "Flight Schedule" },
  { prefix: "/portal/reports/no-show", doctype: "Air Booking" },
  { prefix: "/portal/reports", doctype: "Air Booking" },
  { prefix: "/portal/profile", doctype: null },
  { prefix: "/portal/settings", doctype: null },
  { prefix: "/portal", doctype: null },
];

export function resolveRouteDoctype(pathname: string): string | null | undefined {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/portal";
  const sorted = [...PORTAL_ROUTE_DOCTYPES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, doctype } of sorted) {
    const normalized = prefix.replace(/\/$/, "");
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      return doctype;
    }
  }
  return undefined;
}

export const PORTAL_ROUTE_ALLOWED_ROLES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/portal/permissions/roles", roles: ["System Manager"] },
  { prefix: "/portal/permissions/role-profiles", roles: ["System Manager"] },
  { prefix: "/portal/users/staff", roles: ["System Manager"] },
];

export function resolveRouteAllowedRoles(pathname: string): string[] | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/portal";
  const sorted = [...PORTAL_ROUTE_ALLOWED_ROLES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, roles } of sorted) {
    const normalized = prefix.replace(/\/$/, "");
    if (path === normalized || path.startsWith(`${normalized}/`)) {
      return roles;
    }
  }
  return null;
}

export function userHasAnyRequiredRole(
  userRoles: string[] | null | undefined,
  requiredRoles: string[] | null | undefined,
) {
  if (!requiredRoles?.length) return true;
  const current = new Set(userRoles || []);
  return requiredRoles.some((role) => current.has(role));
}

export function canAccessDoctype(
  permissions: PortalPermissionsMap | null | undefined,
  doctype: string | null | undefined,
  ptype: PortalPermissionType = "read",
  hasFullAccess = false,
  isLoading = false,
): boolean {
  if (hasFullAccess) return true;
  if (!doctype) return true;
  if (isLoading) return true;
  if (!permissions) return false;
  const doctypePerms = permissions[doctype];
  if (ptype === "read") {
    return doctypePerms?.read === 1 || doctypePerms?.select === 1;
  }
  // if_owner-only write/create/delete are not global — row-level flags from the API gate actions.
  if (doctypePerms?.owner_scoped?.[ptype] === 1 && doctypePerms?.[ptype] !== 1) {
    return false;
  }
  return doctypePerms?.[ptype] === 1;
}

/** Whether the user may perform an action on a specific list row (from API doc permission flags). */
export function canActOnRow(
  row: { can_write?: number | boolean; can_delete?: number | boolean; can_read?: number | boolean } | null | undefined,
  ptype: "read" | "write" | "delete" = "write",
): boolean {
  if (!row) return false;
  if (ptype === "read") return row.can_read === 1 || row.can_read === true;
  if (ptype === "delete") return row.can_delete === 1 || row.can_delete === true;
  return row.can_write === 1 || row.can_write === true;
}

export function filterNavByPermissions<T extends {
  doctype?: string | null;
  reportKey?: AgentReportKey | null;
  allowedRoles?: string[] | null;
}>(
  items: T[],
  permissions: PortalPermissionsMap | null | undefined,
  hasFullAccess = false,
  permissionsReady = false,
  agentReports?: AgentReportPermissions | null,
  userRoles?: string[] | null,
): T[] {
  const roleFiltered = items.filter((item) => userHasAnyRequiredRole(userRoles, item.allowedRoles));
  if (hasFullAccess) return roleFiltered;
  if (!permissionsReady || !permissions) return roleFiltered;
  return roleFiltered.filter((item) => {
    if (item.reportKey && !canViewAgentReport(agentReports, item.reportKey, hasFullAccess)) {
      return false;
    }
    return canAccessDoctype(permissions, item.doctype, "read");
  });
}
