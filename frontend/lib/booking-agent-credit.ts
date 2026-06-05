export type BookingAgentProfile = {
  name: string;
  status?: string;
  can_confirm_ticket?: string;
  can_confirm_on_credit?: boolean;
  credit_available?: number;
  confirmation_mode?: string;
};

/** True when the logged-in user has an active agent profile that may confirm on credit. */
export function userCanConfirmOnCredit(
  profile: BookingAgentProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.status && profile.status !== "Active") return false;
  if (profile.can_confirm_ticket === "No") return false;
  return !!profile.can_confirm_on_credit;
}

/** Tooltip text when Confirm on Credit must stay disabled for this user. */
export function confirmOnCreditDisabledReason(
  profile: BookingAgentProfile | null | undefined,
): string {
  if (!profile) {
    return "You do not have a linked active booking agent profile. An administrator must link your user to a Booking Agent with credit confirmation enabled.";
  }
  if (profile.status && profile.status !== "Active") {
    return "Your booking agent profile is not active.";
  }
  if (profile.can_confirm_ticket === "No") {
    return "Your agent profile is not allowed to confirm tickets.";
  }
  if (profile.confirmation_mode === "Booking Only") {
    return "Your agent profile is booking-only. Credit confirmation needs a credit limit and deposit not required.";
  }
  return "Credit confirmation is not enabled on your agent profile.";
}
