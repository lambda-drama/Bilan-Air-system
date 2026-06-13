import type { PublicCabinClassOption } from "@/services/search";

export type CabinClassOption = string;

export const FALLBACK_CABIN_OPTIONS: { value: CabinClassOption; label: string }[] = [
  { value: "Economy", label: "Economy" },
  { value: "Business", label: "Business" },
  { value: "First Class", label: "First Class" },
];

export const DEFAULT_CABIN: CabinClassOption = "Economy";

export function cabinOptionsFromApi(
  rows: PublicCabinClassOption[],
): { value: CabinClassOption; label: string }[] {
  if (!rows.length) return FALLBACK_CABIN_OPTIONS;
  return rows.map((row) => ({
    value: row.cabin_name,
    label: row.cabin_name,
  }));
}

export function normalizeCabinSelection(
  value: string | null | undefined,
  options: { value: string; label: string }[],
): CabinClassOption {
  if (value && options.some((opt) => opt.value === value)) return value;
  return options[0]?.value || DEFAULT_CABIN;
}
