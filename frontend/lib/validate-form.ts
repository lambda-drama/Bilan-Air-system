export type RequiredField = { key: string; label: string };

export function getMissingRequired(
  values: Record<string, unknown>,
  fields: RequiredField[],
): string[] {
  return fields
    .filter(({ key }) => {
      const value = values[key];
      if (value === null || value === undefined) return true;
      if (typeof value === "string" && !value.trim()) return true;
      return false;
    })
    .map(({ label }) => label);
}

/** @returns true when there are missing required fields */
export function hasMissingRequired(missing: string[]): boolean {
  return missing.length > 0;
}
