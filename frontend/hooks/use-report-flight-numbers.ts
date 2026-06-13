"use client";

import { useEffect, useState } from "react";
import type { SearchableSelectOption } from "@/components/portal/searchable-select";
import { listReportFlightNumbers } from "@/services/portal";

export function useReportFlightNumbers() {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReportFlightNumbers()
      .then((numbers) => {
        if (cancelled) return;
        setOptions(
          numbers.map((flightNumber) => ({
            value: flightNumber,
            label: flightNumber,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { flightNumberOptions: options, loadingFlightNumbers: loading };
}
