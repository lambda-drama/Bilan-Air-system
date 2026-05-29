import {
  buildSearchLegs,
  decodeLegsParam,
  encodeLegsParam,
  type TripSearchLeg,
  type TripType,
} from './trip-types';

export function buildFlightsSearchUrl(options: {
  tripType: TripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  multiLegs?: TripSearchLeg[];
  leg?: number;
}): string {
  const {
    tripType,
    origin,
    destination,
    departureDate,
    returnDate,
    passengers,
    multiLegs,
    leg = 0,
  } = options;

  const searchLegs = buildSearchLegs(
    tripType,
    origin,
    destination,
    departureDate,
    returnDate,
    multiLegs,
  );

  const params = new URLSearchParams({
    trip: tripType,
    passengers: passengers.toString(),
    leg: leg.toString(),
  });

  if (tripType === 'multicity') {
    params.set('legs', encodeLegsParam(searchLegs));
    const active = searchLegs[leg] || searchLegs[0];
    if (active) {
      params.set('origin', active.origin);
      params.set('destination', active.destination);
      params.set('date', active.date);
    }
  } else {
    params.set('origin', origin);
    params.set('destination', destination);
    params.set('date', departureDate);
    if (tripType === 'return') {
      params.set('returnDate', returnDate || departureDate);
    }
  }

  return `/flights?${params.toString()}`;
}

export function parseFlightsSearchParams(searchParams: URLSearchParams) {
  const tripType = (searchParams.get('trip') || 'oneway') as TripType;
  const passengers = parseInt(searchParams.get('passengers') || '1', 10);
  const leg = parseInt(searchParams.get('leg') || '0', 10);
  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';
  const returnDate = searchParams.get('returnDate') || '';

  let searchLegs: TripSearchLeg[];
  if (tripType === 'multicity') {
    searchLegs = decodeLegsParam(searchParams.get('legs'));
    if (searchLegs.length === 0 && origin && destination && date) {
      searchLegs = [{ origin, destination, date }];
    }
  } else {
    searchLegs = buildSearchLegs(tripType, origin, destination, date, returnDate);
  }

  const activeLeg = searchLegs[leg] || searchLegs[0];

  return {
    tripType,
    passengers,
    leg,
    origin: activeLeg?.origin || origin,
    destination: activeLeg?.destination || destination,
    date: activeLeg?.date || date,
    returnDate,
    searchLegs,
  };
}
