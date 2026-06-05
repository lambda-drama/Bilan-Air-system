"use client";

import { useEffect, useState } from "react";
import {
  confirmOnCreditDisabledReason,
  userCanConfirmOnCredit,
  type BookingAgentProfile,
} from "@/lib/booking-agent-credit";
import { fetchPortalUserProfile } from "@/services/userProfile";

export function useBookingAgentCreditEligibility() {
  const [agentProfile, setAgentProfile] = useState<BookingAgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPortalUserProfile()
      .then((profile) => {
        if (!cancelled) {
          setAgentProfile(
            (profile.booking_agent_profile as BookingAgentProfile | null | undefined) ?? null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAgentProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canConfirmOnCredit = userCanConfirmOnCredit(agentProfile);

  return {
    loading,
    agentProfile,
    canConfirmOnCredit,
    confirmOnCreditDisabledReason: canConfirmOnCredit
      ? null
      : confirmOnCreditDisabledReason(agentProfile),
  };
}
