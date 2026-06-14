/** Match backend iter_layout_seat_slots / layout_seat_counts_by_class. */

export type AirplaneSeatConfigRow = Record<string, unknown>;

export function parseLayoutColumns(value: unknown): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const line = raw.split("\n")[0]?.trim() || "";
  return line
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function layoutSeatCountsByClass(
  seatConfig: AirplaneSeatConfigRow[] | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of seatConfig || []) {
    const rows = parseInt(String(row.rows ?? ""), 10) || 0;
    const columns = parseLayoutColumns(row.columns_per_row);
    const seatClass = String(row.seat_class || "").trim();
    if (!seatClass || rows <= 0 || columns.length <= 0) continue;
    counts[seatClass] = (counts[seatClass] || 0) + rows * columns.length;
  }
  return counts;
}

export function layoutSeatClassIds(seatConfig: AirplaneSeatConfigRow[] | undefined): string[] {
  return Object.keys(layoutSeatCountsByClass(seatConfig));
}
