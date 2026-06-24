/** Compact agent label for tables; full name stays available for tooltips/search. */
export function getAgentFirstName(
  fullName: string | null | undefined,
  firstName?: string | null,
): string {
  const first = (firstName || "").trim();
  if (first) return first;
  const full = (fullName || "").trim();
  if (!full) return "";
  return full.split(/\s+/)[0] || full;
}

export function getAgentDisplayName(
  fullName: string | null | undefined,
  firstName?: string | null,
): { full: string; first: string } {
  const full = (fullName || "").trim();
  const first = getAgentFirstName(full, firstName);
  return { full, first };
}
