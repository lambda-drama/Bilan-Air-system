"use client";

import { useEffect, useState } from "react";

/** Debounce updates while typing; apply immediately when value is cleared. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const isEmpty =
      value === "" ||
      value === null ||
      value === undefined ||
      (typeof value === "string" && !value.trim());

    if (isEmpty) {
      setDebounced(value);
      return;
    }

    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
