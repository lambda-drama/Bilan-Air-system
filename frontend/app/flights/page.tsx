'use client';

import { useState, useEffect, useLayoutEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { FlightSchedule } from '@/lib/types';
import { buildIataLabelMapFromRoutes, labelForIata } from '@/lib/format-airport';
import { findFlights, fetchAllRoutes, fetchPublicSeatClasses, fetchPublicCabinClasses, suggestNearestFlightDates, type FlightSearchResponse, type NearestFlightDateSuggestion, type PublicSeatClassOption } from '@/services/search';
import { cabinOptionsFromApi } from '@/lib/cabin-classes';
import { NearestFlightDatesPanel } from '@/components/nearest-flight-dates-panel';
import {
  FlightFareResultCard,
  scheduleRowToFareDisplay,
} from '@/components/flight-fare-result-card';
import { passengerCountsSummary, SEAT_CLASS_OPTIONS } from '@/lib/passenger-search-counts';
import { useCurrency } from '@/contexts/currency-context';
import { parseFlightsSearchParams, buildFlightsSearchUrl } from '@/lib/flights-search-url';
import { buildSchedulesBrowseUrl } from '@/lib/schedules-browse-url';
import { useLocale, useTranslations } from '@/contexts/locale-context';
import { websiteBookingAfterFlightPath } from '@/lib/booking-seat-step';
import { initTripContext, upsertLegSelection, getLegSelection } from '@/lib/trip-store';
import { getBookingSearchDefaults } from '@/services/search';
import { tripLegLabel, type TripSearchLeg } from '@/lib/trip-types';
import { RevealItem, RevealStagger } from '@/components/motion/reveal';

type SeatClass = 'Economy' | 'Business' | 'First Class';

type DisplayFlight = FlightSchedule & {
  aircraft_model?: string | null;
  operator?: string | null;
  stop_count?: number;
};

type LegResults = {
  flights: DisplayFlight[];
  prices: Record<string, Record<string, number>>;
  loading: boolean;
  error: string;
};

function mapFlightResults(
  res: FlightSearchResponse,
  origin: string,
  destination: string,
  date: string,
): { flights: DisplayFlight[]; prices: Record<string, Record<string, number>> } {
  const prices: Record<string, Record<string, number>> = {};
  const flights: DisplayFlight[] = (res.flights || []).map((f) => {
    prices[f.schedule_id] = f.prices || {};
    return {
      name: f.schedule_id,
      flight_number: f.flight_number,
      route: `${origin}-${destination}`,
      origin_code: origin,
      destination_code: destination,
      departure_date: f.departure_date || date,
      departure_time: f.departure_time,
      arrival_date: f.arrival_date || date,
      arrival_time: f.arrival_time,
      aircraft: f.aircraft_model || '',
      aircraft_model: f.aircraft_model,
      operator: f.operator,
      stop_count: f.stop_count,
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
    passengerCounts,
    seatsNeeded,
    seatClass,
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
      searchParams.get('adults'),
      searchParams.get('children'),
      searchParams.get('infants'),
      searchParams.get('class'),
    ],
  );

  const [iataLabels, setIataLabels] = useState<Map<string, string>>(new Map());
  const [seatClasses, setSeatClasses] = useState<PublicSeatClassOption[]>([]);
  const [cabinOptions, setCabinOptions] = useState(SEAT_CLASS_OPTIONS);
  const [nearestByLeg, setNearestByLeg] = useState<
    Record<number, { suggestions: NearestFlightDateSuggestion[]; loading: boolean; checked: boolean }>
  >({});

  const fareCardLabels = {
    adultFare: t.flights.adultFare,
    checkedBaggage: t.flights.checkedBaggage,
    changeFee: t.flights.changeFee,
    refundFee: t.flights.refundFee,
    noShowFee: t.flights.noShowFee,
    select: t.flights.selectFare,
    selected: t.flights.selectedFare,
    direct: t.flights.direct,
    stops: t.flights.stops,
    operatedBy: t.flights.operatedBy,
    standardPolicy: t.flights.standardPolicy,
    seatsAvailable: t.flights.seatsAvailable,
  };

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
    fetchPublicSeatClasses()
      .then(setSeatClasses)
      .catch(() => setSeatClasses([]));
    fetchPublicCabinClasses()
      .then((rows) => setCabinOptions(cabinOptionsFromApi(rows)))
      .catch(() => setCabinOptions(SEAT_CLASS_OPTIONS));
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
          seatsNeeded,
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

        if (!mapped.flights.length) {
          setNearestByLeg((prev) => ({
            ...prev,
            [legIndex]: { suggestions: [], loading: true, checked: false },
          }));
          suggestNearestFlightDates({
            origin: legInfo.origin,
            destination: legInfo.destination,
            anchor_date: legInfo.date,
            passengers: seatsNeeded,
          })
            .then((near) => {
              if (cancelled) return;
              setNearestByLeg((prev) => ({
                ...prev,
                [legIndex]: {
                  suggestions: near.suggestions || [],
                  loading: false,
                  checked: true,
                },
              }));
            })
            .catch(() => {
              if (cancelled) return;
              setNearestByLeg((prev) => ({
                ...prev,
                [legIndex]: { suggestions: [], loading: false, checked: true },
              }));
            });
        } else {
          setNearestByLeg((prev) => {
            const next = { ...prev };
            delete next[legIndex];
            return next;
          });
        }
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
  }, [isReturnCombined, searchLegsKey, leg, origin, destination, date, seatsNeeded]);

  const formatLegDate = (dateStr: string) =>
    dateStr
      ? new Date(`${dateStr}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-SO' : 'en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

  const getFare = (flight: DisplayFlight, legIndex: number, seatClassName: string) => {
    const prices = legResults[legIndex]?.prices[flight.name];
    if (prices?.[seatClassName] != null) return prices[seatClassName];
    return flight.base_fare || 0;
  };

  const goToNextBookingStep = () => {
    initTripContext(tripType, passengers, searchLegs);

    if (isReturnCombined && (!getLegSelection(0) || !getLegSelection(1))) {
      return;
    }

    const params = new URLSearchParams({
      trip: tripType,
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
    params.set('adults', String(passengerCounts.adults));
    params.set('children', String(passengerCounts.children));
    params.set('infants', String(passengerCounts.infants));
    params.set('passengers', String(passengers));
    const firstLeg = getLegSelection(0);
    const cabinForSeats =
      firstLeg?.cabinClass ||
      seatClasses.find((sc) => sc.class_name === firstLeg?.seatClass)?.cabin_name ||
      firstLeg?.seatClass ||
      seatClass;
    if (cabinForSeats && cabinForSeats !== 'Economy') {
      params.set('class', cabinForSeats);
    }
    if (!enableSeatSelection) {
      if (firstLeg) {
        params.set('flight', firstLeg.flightScheduleId);
        if (cabinForSeats) params.set('class', cabinForSeats);
      }
    }
    router.push(websiteBookingAfterFlightPath(params, enableSeatSelection));
  };

  const handleSelectFlight = (
    flight: DisplayFlight,
    legIndex: number,
    legInfo: TripSearchLeg,
    fareClassCode: string,
    fare: number,
    cabinClassName: string,
  ) => {
    upsertLegSelection(
      {
        legIndex,
        origin: legInfo.origin,
        destination: legInfo.destination,
        date: legInfo.date,
        flightScheduleId: flight.name,
        flightNumber: flight.flight_number,
        seatClass: fareClassCode,
        cabinClass: cabinClassName,
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
          passengerCounts,
          seatClass: seatClass,
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

  const formatDaysOffset = (days: number) => {
    if (days === 1) return t.hero.dayLater;
    if (days === -1) return t.hero.dayEarlier;
    if (days > 1) return t.hero.daysLater.replace('{count}', String(days));
    if (days < -1) return t.hero.daysEarlier.replace('{count}', String(Math.abs(days)));
    return t.hero.sameWeekReturn;
  };

  const applyNearestDate = (legIndex: number, legInfo: TripSearchLeg, suggestedDate: string) => {
    if (tripType === 'multicity') {
      const nextLegs = searchLegs.map((l, i) =>
        i === legIndex ? { ...l, date: suggestedDate } : l,
      );
      router.push(
        buildFlightsSearchUrl({
          tripType,
          origin: nextLegs[0].origin,
          destination: nextLegs[0].destination,
          departureDate: nextLegs[0].date,
          passengerCounts,
          seatClass: seatClass,
          multiLegs: nextLegs,
          leg: legIndex,
        }),
      );
      return;
    }

    if (tripType === 'return' && legIndex === 1) {
      router.push(
        buildFlightsSearchUrl({
          tripType,
          origin,
          destination,
          departureDate: date,
          returnDate: suggestedDate,
          passengerCounts,
          seatClass: seatClass,
        }),
      );
      return;
    }

    router.push(
      buildFlightsSearchUrl({
        tripType,
        origin,
        destination,
        departureDate: suggestedDate,
        returnDate: tripType === 'return' ? returnDate : undefined,
        passengerCounts,
        seatClass: seatClass,
        leg: legIndex,
      }),
    );
  };

  const renderFlightCard = (
    flight: DisplayFlight,
    legIndex: number,
    legInfo: TripSearchLeg,
    index: number,
  ) => {
    const legSelection = getLegSelection(legIndex);
    const isSelected = legSelection?.flightScheduleId === flight.name;
    const selectedClassName = isSelected ? legSelection?.seatClass : null;
    const prices = legResults[legIndex]?.prices[flight.name] || {};

    return (
      <RevealItem key={flight.name} index={index}>
        <FlightFareResultCard
          variant="website"
          flight={scheduleRowToFareDisplay(flight, prices, {
            aircraftModel: flight.aircraft_model || flight.aircraft,
            operator: flight.operator,
            stopCount: flight.stop_count,
          })}
          seatClasses={seatClasses}
          cabinFilter={seatClass}
          iataLabels={iataLabels}
          formatMoney={formatMoney}
          formatDate={formatLegDate}
          labels={fareCardLabels}
          isSelected={isSelected}
          selectedClass={selectedClassName}
          onSelect={(fareClassCode) =>
            handleSelectFlight(
              flight,
              legIndex,
              legInfo,
              fareClassCode,
              getFare(flight, legIndex, fareClassCode),
              seatClasses.find((sc) => sc.class_name === fareClassCode)?.cabin_name || seatClass,
            )
          }
        />
      </RevealItem>
    );
  };

  const renderLegSection = (legIndex: number, legInfo: TripSearchLeg) => {
    const results = legResults[legIndex] || emptyLegResults(false);
    const nearest = nearestByLeg[legIndex];
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
            {formatLegDate(legInfo.date)} · {passengerCountsSummary(passengerCounts)}
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
          <div className="text-center py-12 rounded-xl border border-navy/10 bg-white space-y-4">
            <Plane className="w-10 h-10 text-navy/20 mx-auto mb-3" />
            <h3 className="text-navy font-semibold mb-1">{t.flights.noFlights}</h3>
            <p className="text-navy/60 text-sm">{t.flights.noFlightsBody}</p>
            {nearest ? (
              <div className="max-w-md mx-auto text-left px-4">
                <NearestFlightDatesPanel
                  title={t.hero.nearestDateTitle}
                  loadingLabel={t.hero.findingNearbyDates}
                  emptyLabel={t.hero.noNearbyDates}
                  useDateLabel={(d) =>
                    t.hero.useDepartureDate.replace('{date}', formatLegDate(d))
                  }
                  formatDaysOffset={formatDaysOffset}
                  formatFlightCount={(count) =>
                    count > 1
                      ? t.hero.flightsAvailable.replace('{count}', String(count))
                      : t.hero.oneFlightAvailable
                  }
                  formatFromPrice={(amount) =>
                    t.hero.fromPrice.replace('{price}', formatMoney(Math.round(amount)))
                  }
                  suggestions={nearest.suggestions}
                  loading={nearest.loading}
                  checked={nearest.checked}
                  onSelect={(d) => applyNearestDate(legIndex, legInfo, d)}
                />
              </div>
            ) : null}
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
        passengers: seatsNeeded,
        seatClass: seatClass,
      })
    : buildSchedulesBrowseUrl({ origin, destination, date, passengers: seatsNeeded, seatClass });

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
                    {formatLegDate(date)} · {passengerCountsSummary(passengerCounts)}
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
        <p className="mb-6 text-sm text-navy/60">{t.flights.chooseFare}</p>

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
