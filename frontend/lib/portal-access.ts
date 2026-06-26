/** Staff roles allowed to use the agent portal (website customers are excluded). */
export const PORTAL_STAFF_ROLES = [
  'Booking Agent',
  'Check-in Agent',
  'Support Agent',
  'Pricing Manager',
  'Baggage Handler',
  'Crew Member',
  'System Manager',
  'Administrator',
] as const;

/** Roles that bypass portal doctype permission checks (same as Frappe Desk). */
export const FULL_PORTAL_ACCESS_ROLES = ['System Manager', 'Administrator'] as const;

export function hasPortalAccess(roles: string[] | undefined | null): boolean {
  if (!roles?.length) return false;
  return roles.some((role) =>
    (PORTAL_STAFF_ROLES as readonly string[]).includes(role),
  );
}

export function hasFullPortalPermissions(
  roles: string[] | undefined | null,
  userName?: string | null,
): boolean {
  if (userName === 'Administrator') return true;
  if (!roles?.length) return false;
  return roles.some((role) =>
    (FULL_PORTAL_ACCESS_ROLES as readonly string[]).includes(role),
  );
}
