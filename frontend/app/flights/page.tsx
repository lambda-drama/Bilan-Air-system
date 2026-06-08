'use client';

import { useState, useEffect, useLayoutEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, Users, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import type { FlightSchedule } from '@/lib/types';
import { buildIataLabelMapFromRoutes, labelForIata } from '@/lib/format-airport';
import { findFlights, fetchAllRoutes, type FlightSearchResponse } from '@/services/search';
import { useCurrency } from '@/contexts/currency-context';
import { parseFlightsSearchParams, buildFlightsSearchUrl } from '@/lib/flights-search-url';
import { buildSchedulesBrowseUrl } from '@/lib/schedules-browse-url';
import { useLocale, useTranslations } from '@/contexts/locale-context';
import { websiteBookingAfterFlightPath } from '@/lib/booking-seat-step';
import { initTripContext, upsertLegSelection, getLegSelection } from '@/lib/trip-store';
import { getBookingSearchDefaults } from '@/services/search';
import { tripLegLabel, type TripSearchLeg } from '@/lib/trip-types';
import { RevealItem, RevealStagger } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';

type SeatClass = 'Economy' | 'Business' | 'First Class';

type LegResults = {
  flights: FlightSchedule[];
  prices: Record<string, Record<string, number>>;
  loading: boolean;
  error: string;
};

function mapFlightResults(
  res: FlightSearchResponse,
  origin: string,
  destination: string,
  date: string,
): { flights: FlightSchedule[]; prices: Record<string, Record<string, number>> } {
  const prices: Record<string, Record<string, number>> = {};
  const flights: FlightSchedule[] = (res.flights || []).map((f) => {
    prices[f.schedule_id] = f.prices || {};
    return {
      name: f.schedule_id,
      flight_number: f.flight_number,
      route: `${origin}-${destination}`,
      origin_code: origin,
      destination_code: destination,
      departure_date: date,
      departure_time: f.departure_time,
      arrival_date: date,
      arrival_time: f.arrival_time,
      aircraft: '',
      available_seats: f.available_seats,
      status: 'Scheduled',
      base_fare: f.prices?.Economy ?? 0,
    };
  });
  return { flights, prices };
}

function emptyLegResults(loading = true): LegResults {
  return { flights: [], prices: {}, loading, error: '' };
}

function FlightSearchContent() {
  const { formatMoney } = useCurrency();
  const t = useTranslations();
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState<SeatClass>('Economy');
  const [iataLabels, setIataLabels] = useState<Map<string, string>>(new Map());

  const tripParam = searchParams.get('trip') || 'oneway';
  const passengersParam = searchParams.get('passengers') || '1';
  const legParam = searchParams.get('leg') || '0';
  const originParam = searchParams.get('origin') || '';
  const destinationParam = searchParams.get('destination') || '';
  const dateParam = searchParams.get('date') || '';
  const returnDateParam = searchParams.get('returnDate') || '';
  const legsParam = searchParams.get('legs') || '';

  const {
    tripType,
    passengers,
    leg,
    origin,
    destination,
    date,
    returnDate,
    searchLegs,
  } = useMemo(
    () => parseFlightsSearchParams(searchParams),
    [
      tripParam,
      passengersParam,
      legParam,
      originParam,
      destinationParam,
      dateParam,
      returnDateParam,
      legsParam,
    ],
  );

  const searchLegsKey = useMemo(() => JSON.stringify(searchLegs), [searchLegs]);

  const totalLegs = searchLegs.length;
  const isReturnCombined = tripType === 'return' && searchLegs.length === 2;
  const isMultiLegStep = tripType !== 'oneway' && totalLegs > 1 && !isReturnCombined;

  const [legResults, setLegResults] = useState<Record<number, LegResults>>({});
  const [selectedByLeg, setSelectedByLeg] = useState<Record<number, string>>({});
  const [enableSeatSelection, setEnableSeatSelection] = useState(false);

  const tripInit = { tripType, passengers, searchLegs };

  useLayoutEffect(() => {
    initTripContext(tripType, passengers, searchLegs);
    setSelectedByLeg({
      0: getLegSelection(0)?.flightScheduleId || '',
      1: getLegSelection(1)?.flightScheduleId || '',
    });
  }, [tripType, passengers, searchLegsKey, searchLegs]);

  useEffect(() => {
    fetchAllRoutes()
      .then((routes) => setIataLabels(buildIataLabelMapFromRoutes(routes)))
      .catch(() => setIataLabels(new Map()));
  }, []);

  useEffect(() => {
    getBookingSearchDefaults()
      .then((defaults) => setEnableSeatSelection(!!defaults.enable_seat_selection))
      .catch(() => setEnableSeatSelection(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLeg = async (legIndex: number, legInfo: TripSearchLeg) => {
      setLegResults((prev) => ({
        ...prev,
        [legIndex]: { ...emptyLegResults(true), ...prev[legIndex], loading: true, error: '' },
      }));

      try {
        const res = await findFlights(
          legInfo.origin,
          legInfo.destination,
          legInfo.date,
          passengers,
        );
        if (cancelled) return;

        if (res.error) {
          setLegResults((prev) => ({
            ...prev,
            [legIndex]: { flights: [], prices: {}, loading: false, error: res.error || '' },
          }));
          return;
        }

        const mapped = mapFlightResults(res, legInfo.origin, legInfo.destination, legInfo.date);
        setLegResults((prev) => ({
          ...prev,
          [legIndex]: { ...mapped, loading: false, error: '' },
        }));
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Failed to search flights';
        setLegResults((prev) => ({
          ...prev,
          [legIndex]: { flights: [], prices: {}, loading: false, error: message },
        }));
      }
    };

    if (isReturnCombined) {
      const outbound = searchLegs[0];
      const inbound = searchLegs[1];
      if (outbound?.origin && outbound?.destination && outbound?.date) {
        void loadLeg(0, outbound);
      }
      if (inbound?.origin && inbound?.destination && inbound?.date) {
        void loadLeg(1, inbound);
      }
      return () => {
        cancelled = true;
      };
    }

    if (!date || !origin || !destination) {
      setLegResults({
        [leg]: { flights: [], prices: {}, loading: false, error: '' },
      });
      return;
    }

    void loadLeg(leg, { origin, destination, date });
    return () => {
      cancelled = true;
    };
  }, [isReturnCombined, searchLegsKey, leg, origin, destination, date, passengers]);

  const formatLegDate = (dateStr: string) =>
    dateStr
      ? new Date(`${dateStr}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-SO' : 'en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

  const getFare = (flight: FlightSchedule, legIndex: number) => {
    const prices = legResults[legIndex]?.prices[flight.name];
    if (prices?.[selectedClass] != null) return prices[selectedClass];
    return flight.base_fare || 0;
  };

  const goToNextBookingStep = () => {
    initTripContext(tripType, passengers, searchLegs);

    if (isReturnCombined && (!getLegSelection(0) || !getLegSelection(1))) {
      return;
    }

    const params = new URLSearchParams({
      trip: tripType,
      passengers: passengers.toString(),
      leg: '0',
    });
    if (tripType === 'multicity') {
      params.set('legs', searchParams.get('legs') || '');
    } else {
      params.set('origin', searchLegs[0]?.origin || origin);
      params.set('destination', searchLegs[0]?.destination || destination);
      params.set('date', searchLegs[0]?.date || date);
      if (tripType === 'return') {
        params.set('returnDate', returnDate);
      }
    }
    if (!enableSeatSelection) {
      const firstLeg = getLegSelection(0);
      if (firstLeg) {
        params.set('flight', firstLeg.flightScheduleId);
        params.set('class', firstLeg.seatClass);
      }
    }
    router.push(websiteBookingAfterFlightPath(params, enableSeatSelection));
  };

  const handleSelectFlight = (flight: FlightSchedule, legIndex: number, legInfo: TripSearchLeg) => {
    const fare = getFare(flight, legIndex);
    upsertLegSelection(
      {
        legIndex,
        origin: legInfo.origin,
        destination: legInfo.destination,
        date: legInfo.date,
        flightScheduleId: flight.name,
        flightNumber: flight.flight_number,
        seatClass: selectedClass,
        selectedSeatIds: [],
        selectedSeatLabels: [],
        farePerPerson: fare,
      },
      tripInit,
    );

    const nextSelected = { ...selectedByLeg, [legIndex]: flight.name };
    setSelectedByLeg(nextSelected);

    if (isReturnCombined) {
      const outboundId = legIndex === 0 ? flight.name : nextSelected[0];
      const returnId = legIndex === 1 ? flight.name : nextSelected[1];
      if (outboundId && returnId) {
        goToNextBookingStep();
      }
      return;
    }

    if (isMultiLegStep && legIndex < totalLegs - 1) {
      const nextLeg = legIndex + 1;
      router.push(
        buildFlightsSearchUrl({
          tripType,
          origin: searchLegs[0].origin,
          destination: searchLegs[0].destination,
          departureDate: searchLegs[0].date,
          returnDate: tripType === 'return' ? returnDate : undefined,
          passengers,
          multiLegs: tripType === 'multicity' ? searchLegs : undefined,
          leg: nextLeg,
        }),
      );
      return;
    }

    goToNextBookingStep();
  };

  const outboundSelection = getLegSelection(0);
  const returnSelection = getLegSelection(1);

  const renderFlightCard = (
    flight: FlightSchedule,
    legIndex: number,
    legInfo: TripSearchLeg,
    index: number,
  ) => {
    const isSelected = selectedByLeg[legIndex] === flight.name;

    return (
      <RevealItem key={flight.name} index={index}>
        <div
          className={cn(
            'bg-white border rounded-xl p-6 bilan-lift transition-colors',
            isSelected ? 'border-gold ring-2 ring-gold/30' : 'border-navy/10 hover:border-gold/50',
          )}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gold font-semibold">{flight.flight_number}</span>
                {isSelected && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <Check className="w-3 h-3" />
                    {t.flights.selected}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-navy text-2xl font-bold">{flight.departure_time}</p>
                  <p className="text-navy/60 text-sm">
                    {labelForIata(flight.origin_code, iataLabels)}
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 h-px bg-navy/20" />
                    <Plane className="w-4 h-4 text-gold -rotate-90" />
                    <div className="flex-1 h-px bg-navy/20" />
                  </div>
                  <p className="text-navy/40 text-xs mt-2">{t.flights.direct}</p>
                </div>

                <div className="text-center">
                  <p className="text-navy text-2xl font-bold">{flight.arrival_time}</p>
                  <p className="text-navy/60 text-sm">
                    {labelForIata(flight.destination_code, iataLabels)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 lg:border-l lg:border-navy/10 lg:pl-6">
              <div className="text-center">
                <p className="text-navy/60 text-sm flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {flight.available_seats} {t.flights.seats}
                </p>
              </div>

              <div className="text-right">
                <p className="text-navy text-2xl font-bold">
                  {formatMoney(Math.round(getFare(flight, legIndex)))}
                </p>
                <p className="text-navy/60 text-sm">{t.flights.perPerson}</p>
              </div>

              <Button
                onClick={() => handleSelectFlight(flight, legIndex, legInfo)}
                variant={isSelected ? 'outline' : 'default'}
                className={cn(
                  'font-semibold px-6',
                  isSelected
                    ? 'border-gold text-navy hover:bg-gold/10'
                    : 'bg-gold hover:bg-gold-dark text-navy',
                )}
              >
                {isSelected ? t.flights.selected : t.flights.select}
              </Button>
            </div>
          </div>
        </div>
      </RevealItem>
    );
  };

  const renderLegSection = (legIndex: number, legInfo: TripSearchLeg) => {
    const results = legResults[legIndex] || emptyLegResults(false);
    const label =
      legIndex === 0
        ? t.flights.outbound
        : legIndex === 1 && tripType === 'return'
          ? t.flights.returnLeg
          : tripLegLabel(legInfo, legIndex, totalLegs);

    return (
      <section key={legIndex} className="space-y-4">
        <div className="rounded-xl border border-navy/10 bg-white px-5 py-4">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-1">{label}</p>
          <h2 className="text-navy font-serif text-xl">
            {labelForIata(legInfo.origin, iataLabels)}{' '}
            <ArrowRight className="inline w-5 h-5 mx-1 text-gold" />{' '}
            {labelForIata(legInfo.destination, iataLabels)}
          </h2>
          <p className="text-navy/60 text-sm mt-1">
            {formatLegDate(legInfo.date)} · {passengers}{' '}
            {passengers > 1 ? 'passengers' : 'passenger'}
          </p>
        </div>

        {results.loading ? (
          <div className="text-center py-12 rounded-xl border border-navy/10 bg-white">
            <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-navy/60">{t.flights.searching}</p>
          </div>
        ) : results.error ? (
          <div className="text-center py-12 rounded-xl border border-red-200 bg-red-50">
            <p className="text-red-700">{results.error}</p>
          </div>
        ) : results.flights.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-navy/10 bg-white">
            <Plane className="w-10 h-10 text-navy/20 mx-auto mb-3" />
            <h3 className="text-navy font-semibold mb-1">{t.flights.noFlights}</h3>
            <p className="text-navy/60 text-sm">{t.flights.noFlightsBody}</p>
          </div>
        ) : (
          <RevealStagger className="space-y-4">
            {results.flights.map((flight, index) =>
              renderFlightCard(flight, legIndex, legInfo, index),
            )}
          </RevealStagger>
        )}
      </section>
    );
  };

  const singleLegResults = legResults[leg] || emptyLegResults(true);
  const anyLoading = isReturnCombined
    ? (legResults[0]?.loading ?? true) || (legResults[1]?.loading ?? true)
    : singleLegResults.loading;

  const schedulesBrowseHref = isReturnCombined
    ? buildSchedulesBrowseUrl({
        origin: searchLegs[0]?.origin,
        destination: searchLegs[0]?.destination,
        dateFrom: searchLegs[0]?.date,
        dateTo: searchLegs[1]?.date,
        passengers,
      })
    : buildSchedulesBrowseUrl({ origin, destination, date, passengers });

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">
                {isReturnCombined
                  ? t.flights.roundTrip
                  : isMultiLegStep
                    ? t.flights.stepOf
                        .replace('{current}', String(leg + 1))
                        .replace('{total}', String(totalLegs))
                        .toUpperCase()
                    : t.flights.searchResults}
              </p>
              {isReturnCombined ? (
                <>
                  <h1 className="text-cream font-serif text-3xl">{t.flights.returnTrip}</h1>
                  <div className="text-cream/70 mt-3 space-y-1 text-sm">
                    <p>
                      <span className="text-gold font-medium">{t.flights.outbound}:</span>{' '}
                      {labelForIata(searchLegs[0].origin, iataLabels)}{' '}
                      <ArrowRight className="inline w-4 h-4 mx-1" />{' '}
                      {labelForIata(searchLegs[0].destination, iataLabels)} ·{' '}
                      {formatLegDate(searchLegs[0].date)}
                    </p>
                    <p>
                      <span className="text-gold font-medium">{t.flights.returnLeg}:</span>{' '}
                      {labelForIata(searchLegs[1].origin, iataLabels)}{' '}
                      <ArrowRight className="inline w-4 h-4 mx-1" />{' '}
                      {labelForIata(searchLegs[1].destination, iataLabels)} ·{' '}
                      {formatLegDate(searchLegs[1].date)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-cream font-serif text-3xl">
                    {labelForIata(origin, iataLabels)}{' '}
                    <ArrowRight className="inline w-6 h-6 mx-2" />{' '}
                    {labelForIata(destination, iataLabels)}
                  </h1>
                  <p className="text-cream/60 mt-2">
                    {formatLegDate(date)} · {passengers}{' '}
                    {passengers > 1 ? 'passengers' : 'passenger'}
                    {tripType === 'multicity' && ` · ${totalLegs} flights`}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={schedulesBrowseHref}
                className="inline-flex items-center gap-1 text-sm text-cream/70 hover:text-gold transition-colors"
              >
                {t.hero.viewAllSchedules}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Button
                variant="ghost"
                className="bilan-navy-outline-btn"
                onClick={() => router.push('/#book')}
              >
                {t.flights.modifySearch}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-navy/60 text-sm">{t.flights.class}:</span>
          {SEAT_CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedClass === cls
                  ? 'bg-navy text-cream'
                  : 'bg-navy/10 text-navy hover:bg-navy/20'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

        {!isReturnCombined && !date && !origin && !destination ? (
          <div className="text-center py-20">
            <Plane className="w-16 h-16 text-navy/20 mx-auto mb-4" />
            <h3 className="text-navy text-xl font-semibold mb-2">{t.flights.startFromHome}</h3>
            <p className="text-navy/60 mb-6">{t.flights.startFromHomeBody}</p>
            <Button className="bg-gold hover:bg-gold-dark text-navy" onClick={() => router.push('/#book')}>
              {t.flights.openSearch}
            </Button>
          </div>
        ) : isReturnCombined ? (
          <div className="space-y-10">
            {renderLegSection(0, searchLegs[0])}
            {renderLegSection(1, searchLegs[1])}
          </div>
        ) : anyLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-navy/60">{t.flights.searching}</p>
          </div>
        ) : singleLegResults.error ? (
          <div className="text-center py-20">
            <p className="text-red-600">{singleLegResults.error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/#book')}>
              {t.flights.modifySearch}
            </Button>
          </div>
        ) : singleLegResults.flights.length === 0 ? (
          <div className="text-center py-20">
            <Plane className="w-16 h-16 text-navy/20 mx-auto mb-4" />
            <h3 className="text-navy text-xl font-semibold mb-2">{t.flights.noFlights}</h3>
            <p className="text-navy/60 mb-4">{t.flights.noFlightsBody}</p>
            <Button variant="outline" onClick={() => router.push('/#book')}>
              {t.flights.modifySearch}
            </Button>
          </div>
        ) : (
          <RevealStagger className="space-y-4">
            {singleLegResults.flights.map((flight, index) =>
              renderFlightCard(
                flight,
                leg,
                { origin, destination, date },
                index,
              ),
            )}
          </RevealStagger>
        )}
      </div>

      {isReturnCombined && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-navy/10 bg-white/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-navy/70">
              {outboundSelection && returnSelection
                ? `${outboundSelection.flightNumber} · ${returnSelection.flightNumber}`
                : t.flights.selectBothFlights}
            </p>
            <Button
              onClick={goToNextBookingStep}
              disabled={!selectedByLeg[0] || !selectedByLeg[1]}
              className="bg-gold hover:bg-gold-dark text-navy font-semibold disabled:opacity-50"
            >
              {t.flights.continueToSeats}
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}

const SEAT_CLASSES: SeatClass[] = ['Economy', 'Business', 'First Class'];

export default function FlightsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream">
          <Navbar />
          <div className="pt-32 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
          </div>
        </main>
      }
    >
      <FlightSearchContent />
    </Suspense>
  );
}
