export type TripType = 'oneway' | 'return' | 'multicity';

export interface TripSearchLeg {
  origin: string;
  destination: string;
  date: string;
}

export interface TripLegSelection {
  legIndex: number;
  origin: string;
  destination: string;
  date: string;
  flightScheduleId: string;
  flightNumber?: string;
  seatClass: string;
  selectedSeatIds: string[];
  selectedSeatLabels: string[];
  farePerPerson?: number;
}

export interface TripContext {
  tripType: TripType;
  passengers: number;
  searchLegs: TripSearchLeg[];
  selections: TripLegSelection[];
}

export function buildSearchLegs(
  tripType: TripType,
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  multiLegs?: TripSearchLeg[],
): TripSearchLeg[] {
  if (tripType === 'multicity' && multiLegs?.length) {
    return multiLegs.filter((l) => l.origin && l.destination && l.date);
  }
  if (tripType === 'return') {
    return [
      { origin, destination, date: departureDate },
      { origin: destination, destination: origin, date: returnDate || departureDate },
    ];
  }
  return [{ origin, destination, date: departureDate }];
}

export function encodeLegsParam(legs: TripSearchLeg[]): string {
  return encodeURIComponent(JSON.stringify(legs));
}

export function decodeLegsParam(raw: string | null): TripSearchLeg[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as TripSearchLeg[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function tripLegLabel(leg: TripSearchLeg, index: number, total: number) {
  if (total <= 1) return 'Outbound';
  if (total === 2 && index === 0) return 'Outbound';
  if (total === 2 && index === 1) return 'Return';
  return `Flight ${index + 1}`;
}
