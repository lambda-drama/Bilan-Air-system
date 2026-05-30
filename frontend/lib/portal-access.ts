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

export function hasPortalAccess(roles: string[] | undefined | null): boolean {
  if (!roles?.length) return false;
  return roles.some((role) =>
    (PORTAL_STAFF_ROLES as readonly string[]).includes(role),
  );
}
