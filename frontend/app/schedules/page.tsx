'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Loader2,
  Plane,
  Filter,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/portal/searchable-select';
import { useCurrency } from '@/contexts/currency-context';
import { useLocale, useTranslations } from '@/contexts/locale-context';
import { buildFlightsSearchUrl } from '@/lib/flights-search-url';
import {
  buildAirportOptionsFromRoutes,
  airportsToSelectOptions,
  destinationsForOrigin,
  type AirportOption,
} from '@/lib/public-flight-airports';
import {
  buildSchedulesBrowseUrl,
  parseSchedulesBrowseParams,
  type SeatClassFilter,
} from '@/lib/schedules-browse-url';
import { endpointLabel, formatFlightRouteLabel } from '@/lib/format-airport';
import { cn } from '@/lib/utils';
import {
  fetchAllRoutes,
  listPublicSchedules,
  type PublicScheduleRow,
} from '@/services/search';

const SEAT_CLASSES: SeatClassFilter[] = ['Economy', 'Business', 'First Class'];
const STATUS_OPTIONS = ['Scheduled', 'Delayed', 'Boarding', 'Departed', 'Arrived', 'Cancelled'];

const fieldClass =
  'bilan-light-field w-full mt-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gold';

const airportInputClass =
  'bilan-light-field h-auto min-h-[2.5rem] sm:min-h-[2.75rem] py-2 text-sm shadow-none mt-1';

function formatClock(time: string) {
  if (!time) return '—';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

function formatDisplayDate(dateStr: string, locale: string) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
      locale === 'ar' ? 'ar-SO' : 'en-US',
      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
    );
  } catch {
    return dateStr;
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Scheduled':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Delayed':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'Boarding':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Departed':
      return 'bg-navy/10 text-navy border-navy/20';
    case 'Arrived':
      return 'bg-navy/5 text-navy/70 border-navy/10';
    case 'Cancelled':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-navy/5 text-navy/70 border-navy/10';
  }
}

function SchedulesBrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const { locale, isRtl } = useLocale();
  const t = useTranslations();

  const initial = useMemo(() => parseSchedulesBrowseParams(searchParams), [searchParams]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [origin, setOrigin] = useState(initial.origin || '');
  const [destination, setDestination] = useState(initial.destination || '');
  const [route, setRoute] = useState(initial.route || '');
  const [useSingleDate, setUseSingleDate] = useState(Boolean(initial.date && !initial.dateFrom));
  const [date, setDate] = useState(initial.date || initial.dateFrom || today);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom || initial.date || today);
  const [dateTo, setDateTo] = useState(initial.dateTo || '');
  const [flightNumber, setFlightNumber] = useState(initial.flightNumber || '');
  const [status, setStatus] = useState(initial.status || '');
  const [passengers, setPassengers] = useState(initial.passengers || 1);
  const [seatClass, setSeatClass] = useState<SeatClassFilter>(initial.seatClass || 'Economy');
  const [bookableOnly, setBookableOnly] = useState(initial.bookableOnly || false);

  const [origins, setOrigins] = useState<AirportOption[]>([]);
  const [destinationsByOrigin, setDestinationsByOrigin] = useState<
    Map<string, Map<string, AirportOption>>
  >(new Map());
  const [routeOptions, setRouteOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  const [flights, setFlights] = useState<PublicScheduleRow[]>([]);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    setLoadingRoutes(true);
    fetchAllRoutes()
      .then((routes) => {
        const { origins: originList, destinationsByOrigin: destMap } =
          buildAirportOptionsFromRoutes(routes);
        setOrigins(originList);
        setDestinationsByOrigin(destMap);
        setRouteOptions([
          { value: '', label: t.schedules.allRoutes },
          ...routes.map((r) => ({
            value: r.name,
            label:
              r.route_name ||
              `${r.origin_code || r.origin_city} → ${r.destination_code || r.destination_city}`,
          })),
        ]);
      })
      .catch(() => {
        setOrigins([]);
        setDestinationsByOrigin(new Map());
        setRouteOptions([{ value: '', label: t.schedules.allRoutes }]);
      })
      .finally(() => setLoadingRoutes(false));
  }, [t.schedules.allRoutes]);

  const destinationOptions = useMemo(
    () => destinationsForOrigin(destinationsByOrigin, origin),
    [destinationsByOrigin, origin],
  );

  const originSelectOptions = useMemo(() => airportsToSelectOptions(origins), [origins]);
  const destinationSelectOptions = useMemo(
    () => airportsToSelectOptions(destinationOptions),
    [destinationOptions],
  );

  const loadSchedules = useCallback(
    async (filters: ReturnType<typeof parseSchedulesBrowseParams>) => {
      setLoading(true);
      setError('');
      try {
        const useDate = Boolean(filters.date && !filters.dateFrom);
        const params = {
          origin: filters.origin,
          destination: filters.destination,
          route: filters.route,
          flight_number: filters.flightNumber,
          status: filters.status,
          passengers: filters.passengers,
          bookable_only: filters.bookableOnly,
          ...(useDate
            ? { date: filters.date || today }
            : {
                date_from: filters.dateFrom || today,
                date_to: filters.dateTo || undefined,
              }),
        };
        const result = await listPublicSchedules(params);
        setFlights(result.flights);
        setRangeFrom(result.date_from);
        setRangeTo(result.date_to);
      } catch {
        setError(t.schedules.loadError);
        setFlights([]);
      } finally {
        setLoading(false);
      }
    },
    [today, t.schedules.loadError],
  );

  useEffect(() => {
    const parsed = parseSchedulesBrowseParams(searchParams);
    setOrigin(parsed.origin || '');
    setDestination(parsed.destination || '');
    setRoute(parsed.route || '');
    setUseSingleDate(Boolean(parsed.date && !parsed.dateFrom));
    setDate(parsed.date || parsed.dateFrom || today);
    setDateFrom(parsed.dateFrom || parsed.date || today);
    setDateTo(parsed.dateTo || '');
    setFlightNumber(parsed.flightNumber || '');
    setStatus(parsed.status || '');
    setPassengers(parsed.passengers || 1);
    setSeatClass(parsed.seatClass || 'Economy');
    setBookableOnly(parsed.bookableOnly || false);
    loadSchedules(parsed);
  }, [searchParams, loadSchedules, today]);

  const syncUrl = () => {
    const href = buildSchedulesBrowseUrl({
      origin: origin || undefined,
      destination: destination || undefined,
      route: route || undefined,
      flightNumber: flightNumber || undefined,
      status: status || undefined,
      passengers,
      seatClass,
      bookableOnly,
      ...(useSingleDate
        ? { date: date || undefined }
        : { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    });
    router.replace(href);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    syncUrl();
    setFiltersOpen(false);
  };

  const handleClear = () => {
    router.replace('/schedules');
  };

  const handleOriginChange = (code: string) => {
    setOrigin(code);
    setRoute('');
    const dests = destinationsForOrigin(destinationsByOrigin, code);
    if (dests.length > 0) {
      setDestination((prev) => (dests.some((d) => d.code === prev) ? prev : dests[0].code));
    } else {
      setDestination('');
    }
  };

  const visibleFlights = useMemo(() => {
    return flights.filter((flight) => {
      const price = flight.prices?.[seatClass];
      if (price == null && seatClass !== 'Economy') return false;
      return true;
    });
  }, [flights, seatClass]);

  const getFare = (flight: PublicScheduleRow) => {
    const price = flight.prices?.[seatClass];
    if (price != null) return price;
    return flight.prices?.Economy ?? 0;
  };

  const statusLabel = (value: string) =>
    t.schedules.statusLabels[value as keyof typeof t.schedules.statusLabels] ?? value;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (origin) count++;
    if (destination) count++;
    if (route) count++;
    if (flightNumber.trim()) count++;
    if (status) count++;
    if (bookableOnly) count++;
    if (passengers !== 1) count++;
    if (seatClass !== 'Economy') count++;
    if (useSingleDate) {
      if (date && date !== today) count++;
    } else if (dateFrom !== today || dateTo) {
      count++;
    }
    return count;
  }, [
    origin,
    destination,
    route,
    flightNumber,
    status,
    bookableOnly,
    passengers,
    seatClass,
    useSingleDate,
    date,
    dateFrom,
    dateTo,
    today,
  ]);

  const toggleFilters = () => setFiltersOpen((open) => !open);

  const filterIconToggle = (
    <Button
      type="button"
      size="icon"
      variant={filtersOpen ? 'default' : 'outline'}
      className={cn(
        'lg:hidden shrink-0 relative h-10 w-10',
        filtersOpen
          ? 'bg-navy text-cream hover:bg-navy/90'
          : 'border-navy/20 text-navy hover:bg-navy/5',
      )}
      onClick={toggleFilters}
      aria-expanded={filtersOpen}
      aria-controls="schedules-filters-panel"
      aria-label={filtersOpen ? t.schedules.hideFilters : t.schedules.filters}
    >
      {filtersOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
      {activeFilterCount > 0 && !filtersOpen && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
          {activeFilterCount}
        </span>
      )}
    </Button>
  );

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">
            {t.schedules.eyebrow}
          </p>
          <div className="min-w-0">
            <h1 className="text-cream font-serif text-3xl md:text-4xl">{t.schedules.title}</h1>
            <p className="text-cream/60 mt-3 max-w-2xl">{t.schedules.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid lg:grid-cols-[minmax(0,280px)_1fr] gap-4 lg:gap-8 items-start">
          <aside
            id="schedules-filters-panel"
            className={cn(
              'order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:sticky lg:top-24',
              filtersOpen ? 'block' : 'hidden lg:block',
            )}
          >
            <form
              onSubmit={handleApply}
              className="rounded-xl lg:rounded-2xl border border-navy/10 bg-white shadow-sm p-4 sm:p-5 lg:p-6 space-y-3 max-lg:max-h-[min(70vh,28rem)] max-lg:overflow-y-auto"
            >
              <h2 className="text-base sm:text-lg font-serif text-navy">{t.schedules.filters}</h2>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.from}
                </label>
                <SearchableSelect
                  options={originSelectOptions}
                  value={origin}
                  onValueChange={handleOriginChange}
                  placeholder={t.hero.searchPlaceholder}
                  emptyMessage={t.hero.noOrigin}
                  disabled={origins.length === 0 || loadingRoutes}
                  isLoading={loadingRoutes}
                  clearable
                  inputClassName={airportInputClass}
                />
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.to}
                </label>
                <SearchableSelect
                  options={destinationSelectOptions}
                  value={destination}
                  onValueChange={(code) => {
                    setDestination(code);
                    setRoute('');
                  }}
                  placeholder={t.hero.searchPlaceholder}
                  emptyMessage={t.hero.noDestination}
                  disabled={destinationOptions.length === 0 || loadingRoutes}
                  isLoading={loadingRoutes}
                  clearable
                  inputClassName={airportInputClass}
                />
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.route}
                </label>
                <SearchableSelect
                  options={routeOptions}
                  value={route}
                  onValueChange={(value) => {
                    setRoute(value);
                    if (value) {
                      setOrigin('');
                      setDestination('');
                    }
                  }}
                  placeholder={t.schedules.allRoutes}
                  emptyMessage={t.schedules.allRoutes}
                  disabled={loadingRoutes}
                  isLoading={loadingRoutes}
                  clearable
                  inputClassName={airportInputClass}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseSingleDate(true)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition-colors',
                    useSingleDate
                      ? 'bg-navy text-cream border-navy'
                      : 'bg-cream text-navy/70 border-navy/15 hover:bg-navy/5',
                  )}
                >
                  {t.schedules.date}
                </button>
                <button
                  type="button"
                  onClick={() => setUseSingleDate(false)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition-colors',
                    !useSingleDate
                      ? 'bg-navy text-cream border-navy'
                      : 'bg-cream text-navy/70 border-navy/15 hover:bg-navy/5',
                  )}
                >
                  {t.schedules.dateFrom}
                </button>
              </div>

              {useSingleDate ? (
                <div>
                  <label className="text-navy/60 text-xs font-semibold tracking-wider">
                    {t.schedules.date}
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={today}
                    className={fieldClass}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-navy/60 text-xs font-semibold tracking-wider">
                      {t.schedules.dateFrom}
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      min={today}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-xs font-semibold tracking-wider">
                      {t.schedules.dateTo}
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={dateFrom || today}
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.flightNumber}
                </label>
                <Input
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="BA101"
                  className="bilan-light-field mt-1"
                />
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.status}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">{t.schedules.allStatuses}</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {statusLabel(opt)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {t.schedules.passengers}
                </label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={passengers}
                  onChange={(e) => setPassengers(parseInt(e.target.value, 10) || 1)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider mb-2 block">
                  {t.schedules.seatClass}
                </label>
                <div className="flex flex-wrap gap-2">
                  {SEAT_CLASSES.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSeatClass(cls)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        seatClass === cls
                          ? 'bg-navy text-cream'
                          : 'bg-navy/10 text-navy hover:bg-navy/20',
                      )}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-navy/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookableOnly}
                  onChange={(e) => setBookableOnly(e.target.checked)}
                  className="rounded border-navy/30"
                />
                {t.schedules.bookableOnly}
              </label>

              <div
                className={cn(
                  'flex flex-col sm:flex-row gap-2 pt-1',
                  isRtl && 'sm:flex-row-reverse',
                )}
              >
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-gold hover:bg-gold-dark text-navy gap-2"
                >
                  <Search className="w-4 h-4" />
                  {t.schedules.applyFilters}
                </Button>
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleClear}>
                  {t.schedules.clearFilters}
                </Button>
              </div>
            </form>
          </aside>

          <div className="contents lg:flex lg:flex-col lg:col-start-2 lg:gap-4 min-w-0">
            <div className="order-1 lg:order-none min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="flex items-start justify-between gap-3 w-full sm:w-auto min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-serif text-navy">{t.schedules.results}</h2>
                    <p className="text-navy/60 text-sm mt-1">
                      {t.schedules.resultsCount.replace('{count}', String(visibleFlights.length))}
                      {rangeFrom && rangeTo
                        ? ` · ${t.schedules.dateRange
                            .replace('{from}', formatDisplayDate(rangeFrom, locale))
                            .replace('{to}', formatDisplayDate(rangeTo, locale))}`
                        : ''}
                    </p>
                  </div>
                  {filterIconToggle}
                </div>
                <button
                  type="button"
                  onClick={() => loadSchedules(parseSchedulesBrowseParams(searchParams))}
                  className="inline-flex items-center gap-2 text-sm text-navy/60 hover:text-navy shrink-0"
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            <section className="order-3 lg:order-none min-w-0 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {loading && visibleFlights.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-navy/10 bg-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gold" />
                <p className="text-navy/60">{t.schedules.loading}</p>
              </div>
            ) : visibleFlights.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-navy/10 bg-white">
                <Plane className="w-12 h-12 text-navy/20 mx-auto mb-3" />
                <p className="text-navy/60">{t.schedules.noResults}</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/#book')}>
                  {t.hero.searchFlights}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-navy/10 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead>
                      <tr className="border-b border-navy/10 bg-navy/5 text-left text-xs uppercase tracking-wide text-navy/60">
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.flight}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.route}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.date}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.departure}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.arrival}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.status}</th>
                        <th className="px-4 py-3 font-semibold">{t.schedules.columns.fare}</th>
                        <th className="px-4 py-3 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleFlights.map((flight) => (
                        <tr
                          key={flight.schedule_id}
                          className="border-b border-navy/5 hover:bg-gold/5 transition-colors"
                        >
                          <td className="px-4 py-4 font-semibold text-navy">
                            {flight.flight_number}
                          </td>
                          <td className="px-4 py-4 text-navy/80">
                            {formatFlightRouteLabel(flight)}
                          </td>
                          <td className="px-4 py-4 text-navy/70">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-navy/40" />
                              {formatDisplayDate(flight.departure_date, locale)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium">{formatClock(flight.departure_time)}</p>
                            <p className="text-xs text-navy/50">
                              {endpointLabel(flight.origin_code, flight.origin_label)}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium">{formatClock(flight.arrival_time)}</p>
                            <p className="text-xs text-navy/50">
                              {endpointLabel(flight.destination_code, flight.destination_label)}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                statusBadgeClass(flight.status),
                              )}
                            >
                              {statusLabel(flight.status)}
                            </span>
                            <p className="text-xs text-navy/50 mt-1 inline-flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {t.schedules.seats.replace('{count}', String(flight.available_seats))}
                            </p>
                          </td>
                          <td className="px-4 py-4 font-semibold text-navy">
                            {formatMoney(Math.round(getFare(flight)))}
                            <p className="text-xs font-normal text-navy/50">{seatClass}</p>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {flight.bookable ? (
                              <Link
                                href={buildFlightsSearchUrl({
                                  tripType: 'oneway',
                                  origin: flight.origin_code,
                                  destination: flight.destination_code,
                                  departureDate: flight.departure_date,
                                  passengers,
                                })}
                              >
                                <Button
                                  size="sm"
                                  className="bg-gold hover:bg-gold-dark text-navy font-semibold"
                                >
                                  {t.schedules.book}
                                  <ArrowRight className="w-3.5 h-3.5 ms-1" />
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-xs text-navy/40">{t.schedules.notBookable}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function SchedulesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream">
          <Navbar />
          <div className="pt-32 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-gold" />
          </div>
        </main>
      }
    >
      <SchedulesBrowseContent />
    </Suspense>
  );
}
