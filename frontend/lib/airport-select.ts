import type { SearchableSelectOption } from "@/components/portal/searchable-select";

export type AirportSelectRow = {
  name: string;
  airport_name?: string;
  iata_code?: string;
  city?: string;
  country?: string;
};

/** Options for Link → Airport fields (show airport name, not route-style IDs). */
export function buildAirportSelectOptions(rows: AirportSelectRow[]): SearchableSelectOption[] {
  return rows.map((a) => {
    const iata = (a.iata_code || "").trim().toUpperCase();
    const title = (a.airport_name || a.name || "").trim();
    const place = [a.city, a.country].filter(Boolean).join(", ");

    return {
      value: a.name,
      label: iata ? `${iata} — ${title}` : title,
      description: place || undefined,
    };
  });
}
