/** Fare class label for price lists — avoids repeating the cabin name. */
export function formatFareClassLabel(
  className: string | null | undefined,
  cabinName?: string | null,
): string {
  const code = (className || "").trim();
  const cabin = (cabinName || "").trim();
  if (!code) return "";
  if (!cabin) return code;
  if (code.toLowerCase() === cabin.toLowerCase()) return code;
  if (code.toLowerCase().includes(cabin.toLowerCase())) return code;
  return `${code} ${cabin}`;
}
