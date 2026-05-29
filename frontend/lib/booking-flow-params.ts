/** Query params carried through traveler booking steps (after seat selection). */
export const BOOKING_FLOW_KEYS = [
  "trip",
  "leg",
  "legs",
  "returnDate",
  "flight",
  "class",
  "seats",
  "seatLabels",
  "passengers",
  "origin",
  "destination",
  "date",
] as const;

export function bookingFlowParamsFromSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of BOOKING_FLOW_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return params;
}

export function bookingFlowPath(
  path: string,
  searchParams: URLSearchParams,
): string {
  const q = bookingFlowParamsFromSearchParams(searchParams).toString();
  return q ? `${path}?${q}` : path;
}
