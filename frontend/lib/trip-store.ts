import type { TripContext, TripLegSelection, TripSearchLeg, TripType } from './trip-types';

const KEY = 'bilan_trip_context';

export function saveTripContext(ctx: TripContext) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(ctx));
}

export function loadTripContext(): TripContext | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TripContext;
  } catch {
    return null;
  }
}

export function clearTripContext() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

export function initTripContext(
  tripType: TripType,
  passengers: number,
  searchLegs: TripSearchLeg[],
): TripContext {
  const existing = loadTripContext();
  const sameSearch =
    existing &&
    existing.tripType === tripType &&
    existing.passengers === passengers &&
    JSON.stringify(existing.searchLegs) === JSON.stringify(searchLegs);

  if (sameSearch && existing) {
    return existing;
  }

  const ctx: TripContext = {
    tripType,
    passengers,
    searchLegs,
    selections: [],
  };
  saveTripContext(ctx);
  return ctx;
}

export function upsertLegSelection(selection: TripLegSelection) {
  const ctx = loadTripContext();
  if (!ctx) return null;
  const next = ctx.selections.filter((s) => s.legIndex !== selection.legIndex);
  next.push(selection);
  next.sort((a, b) => a.legIndex - b.legIndex);
  ctx.selections = next;
  saveTripContext(ctx);
  return ctx;
}

export function getLegSelection(legIndex: number): TripLegSelection | undefined {
  return loadTripContext()?.selections.find((s) => s.legIndex === legIndex);
}
