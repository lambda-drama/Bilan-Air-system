"use client";

import { useEffect, useState } from "react";
import { getBookingSearchDefaults } from "@/services/search";

export function useBookingSettings() {
  const [enableSeatSelection, setEnableSeatSelection] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBookingSearchDefaults()
      .then((defaults) => {
        if (!cancelled) setEnableSeatSelection(!!defaults.enable_seat_selection);
      })
      .catch(() => {
        if (!cancelled) setEnableSeatSelection(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    enableSeatSelection: enableSeatSelection ?? false,
    loading: enableSeatSelection === null,
  };
}
