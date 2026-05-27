"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

/** Filter an in-memory list as the user types; reset instantly when search is cleared. */
export function useClientListFilter<T extends object>(
  items: T[],
  matchKeys: (keyof T)[],
  debounceMs = 300,
) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const keysKey = matchKeys.join("|");

  const filtered = useMemo(() => {
    const q = typeof debouncedSearch === "string" ? debouncedSearch.trim().toLowerCase() : "";
    if (!q) return items;
    return items.filter((item) =>
      matchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keysKey stabilizes matchKeys
  }, [items, debouncedSearch, keysKey]);

  return { search, setSearch, filtered };
}
