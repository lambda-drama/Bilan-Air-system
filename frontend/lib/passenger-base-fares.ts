export type PassengerFareKey = "adult" | "child" | "infant";

export type PassengerBaseFares = Record<PassengerFareKey, number>;

export const PASSENGER_FARE_LABELS: Record<PassengerFareKey, string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

export const PASSENGER_FARE_KEYS: PassengerFareKey[] = ["adult", "child", "infant"];

export type PassengerBaseFaresForm = Record<PassengerFareKey, string>;

export const emptyPassengerFaresForm = (): PassengerBaseFaresForm => ({
  adult: "",
  child: "",
  infant: "",
});

const ROUTE_FIELDS: Record<PassengerFareKey, string> = {
  adult: "base_fare_adult",
  child: "base_fare_child",
  infant: "base_fare_infant",
};

const OVERRIDE_FIELDS: Record<PassengerFareKey, string> = {
  adult: "base_fare_adult_override",
  child: "base_fare_child_override",
  infant: "base_fare_infant_override",
};

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Read fares from route row/API (Currency columns or legacy base_fares JSON). */
export function faresFromRouteRow(row: Record<string, unknown>): PassengerBaseFares | null {
  const adult = numOrNull(row.base_fare_adult ?? row.base_fare);
  if (adult === null) {
    return parseBaseFaresInput(row.base_fares, numOrNull(row.base_fare));
  }
  const result: PassengerBaseFares = { adult };
  const child = numOrNull(row.base_fare_child);
  const infant = numOrNull(row.base_fare_infant);
  if (child !== null) result.child = child;
  if (infant !== null) result.infant = infant;
  return result;
}

export function parseBaseFaresInput(
  value: unknown,
  legacyAdult?: number | null,
): PassengerBaseFares | null {
  let raw: Record<string, unknown> | null = null;
  if (typeof value === "string" && value.trim()) {
    try {
      raw = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (value && typeof value === "object") {
    raw = value as Record<string, unknown>;
  }
  const adultRaw = raw?.adult ?? legacyAdult;
  if (adultRaw === undefined || adultRaw === null || adultRaw === "") return null;
  const adult = Number(adultRaw);
  if (Number.isNaN(adult) || adult < 0) return null;

  const result: PassengerBaseFares = { adult };
  for (const key of ["child", "infant"] as const) {
    const v = raw?.[key];
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= 0) result[key] = n;
    }
  }
  return result;
}

export function faresToForm(
  fares?: Partial<PassengerBaseFares> | null,
): PassengerBaseFaresForm {
  if (!fares) return emptyPassengerFaresForm();
  return {
    adult: fares.adult != null ? String(fares.adult) : "",
    child: fares.child != null ? String(fares.child) : "",
    infant: fares.infant != null ? String(fares.infant) : "",
  };
}

/** Schedule override from flat API fields or legacy JSON. */
export function overrideFormFromSchedule(doc: Record<string, unknown>): PassengerBaseFaresForm {
  const adult = numOrNull(doc.base_fare_adult_override);
  if (adult !== null || doc.base_fare_child_override != null || doc.base_fare_infant_override != null) {
    return {
      adult: adult != null ? String(adult) : "",
      child:
        doc.base_fare_child_override != null && doc.base_fare_child_override !== ""
          ? String(doc.base_fare_child_override)
          : "",
      infant:
        doc.base_fare_infant_override != null && doc.base_fare_infant_override !== ""
          ? String(doc.base_fare_infant_override)
          : "",
    };
  }
  return overrideFormFromApi(
    parseBaseFaresInput(doc.base_fares_override, numOrNull(doc.base_fare_override)) ?? undefined,
  );
}

export function overrideFormFromApi(
  override?: Partial<PassengerBaseFares> | null,
): PassengerBaseFaresForm {
  return faresToForm(override ?? null);
}

export function buildRouteFarePayload(form: PassengerBaseFaresForm): Record<string, number> | null {
  const adult = parseFloat(form.adult);
  if (Number.isNaN(adult) || adult < 0) return null;
  const payload: Record<string, number> = { [ROUTE_FIELDS.adult]: adult };
  for (const key of ["child", "infant"] as const) {
    const trimmed = form[key].trim();
    if (!trimmed) continue;
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0) return null;
    payload[ROUTE_FIELDS[key]] = n;
  }
  return payload;
}

export function buildOverridePayload(
  form: PassengerBaseFaresForm,
): Record<string, number | null> | null {
  const out: Record<string, number | null> = {};
  let any = false;
  for (const key of PASSENGER_FARE_KEYS) {
    const trimmed = form[key].trim();
    if (!trimmed) {
      out[OVERRIDE_FIELDS[key]] = null;
      continue;
    }
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0) return null;
    out[OVERRIDE_FIELDS[key]] = n;
    any = true;
  }
  return any ? out : null;
}

/** @deprecated Use buildOverridePayload — returns partial dict for APIs that still accept base_fares_override */
export function buildOverridePayloadLegacy(
  form: PassengerBaseFaresForm,
): Partial<PassengerBaseFares> | null {
  const flat = buildOverridePayload(form);
  if (!flat) return null;
  const out: Partial<PassengerBaseFares> = {};
  for (const key of PASSENGER_FARE_KEYS) {
    const v = flat[OVERRIDE_FIELDS[key]];
    if (v != null) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function formatFaresSummary(
  fares: Partial<PassengerBaseFares> | null | undefined,
  formatMoney: (n: number) => string,
): string {
  if (!fares?.adult && fares?.adult !== 0) return "—";
  const parts = PASSENGER_FARE_KEYS.map((key) => {
    const v = fares[key];
    if (v == null) return null;
    return `${PASSENGER_FARE_LABELS[key]} ${formatMoney(v)}`;
  }).filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}
