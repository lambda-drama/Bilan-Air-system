export type SeatClassFilter = 'Economy' | 'Business' | 'First Class';

export type SchedulesBrowseParams = {
  origin?: string;
  destination?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  route?: string;
  flightNumber?: string;
  status?: string;
  passengers?: number;
  seatClass?: SeatClassFilter;
  bookableOnly?: boolean;
};

export function buildSchedulesBrowseUrl(options: SchedulesBrowseParams = {}): string {
  const params = new URLSearchParams();

  if (options.origin) params.set('origin', options.origin);
  if (options.destination) params.set('destination', options.destination);
  if (options.date) params.set('date', options.date);
  if (options.dateFrom) params.set('dateFrom', options.dateFrom);
  if (options.dateTo) params.set('dateTo', options.dateTo);
  if (options.route) params.set('route', options.route);
  if (options.flightNumber) params.set('flightNumber', options.flightNumber);
  if (options.status) params.set('status', options.status);
  if (options.passengers != null && options.passengers > 0) {
    params.set('passengers', String(options.passengers));
  }
  if (options.seatClass) params.set('class', options.seatClass);
  if (options.bookableOnly) params.set('bookable', '1');

  const query = params.toString();
  return query ? `/schedules?${query}` : '/schedules';
}

export function parseSchedulesBrowseParams(searchParams: URLSearchParams): SchedulesBrowseParams {
  const seatClass = searchParams.get('class');
  const validClass =
    seatClass === 'Economy' || seatClass === 'Business' || seatClass === 'First Class'
      ? seatClass
      : undefined;

  const passengers = parseInt(searchParams.get('passengers') || '1', 10);

  return {
    origin: searchParams.get('origin') || undefined,
    destination: searchParams.get('destination') || undefined,
    date: searchParams.get('date') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    route: searchParams.get('route') || undefined,
    flightNumber: searchParams.get('flightNumber') || undefined,
    status: searchParams.get('status') || undefined,
    passengers: Number.isFinite(passengers) && passengers > 0 ? passengers : 1,
    seatClass: validClass,
    bookableOnly: searchParams.get('bookable') === '1',
  };
}
