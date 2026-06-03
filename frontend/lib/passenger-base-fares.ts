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

/** Partial override for schedule (empty string = use route fare for that type). */
export function overrideFormFromApi(
  override?: Partial<PassengerBaseFares> | null,
): PassengerBaseFaresForm {
  return faresToForm(override ?? null);
}

export function buildOverridePayload(
  form: PassengerBaseFaresForm,
): Partial<PassengerBaseFares> | null {
  const out: Partial<PassengerBaseFares> = {};
  for (const key of PASSENGER_FARE_KEYS) {
    const trimmed = form[key].trim();
    if (!trimmed) continue;
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0) return null;
    out[key] = n;
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
