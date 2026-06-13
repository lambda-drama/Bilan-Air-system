'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plane, ArrowRight, ArrowUpRight, Search, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAllRoutes,
  findFlights,
  getBookingSearchDefaults,
  suggestNearestFlightDates,
  type NearestFlightDateSuggestion,
} from '@/services/search';
import {
  buildAirportOptionsFromRoutes,
  destinationsForOrigin,
  airportsToSelectOptions,
  type AirportOption,
} from '@/lib/public-flight-airports';
import { cn } from '@/lib/utils';
import { TripTypeSelector } from '@/components/trip-type-selector';
import { SearchableSelect } from '@/components/portal/searchable-select';
import { FlightSearchPassengersCabin } from '@/components/flight-search-passengers-cabin';
import { NearestFlightDatesPanel } from '@/components/nearest-flight-dates-panel';
import { buildFlightsSearchUrl } from '@/lib/flights-search-url';
import {
  DEFAULT_PASSENGER_COUNTS,
  seatsRequired,
  totalPassengers,
  type PassengerSearchCounts,
  type SeatClassOption,
} from '@/lib/passenger-search-counts';
import { buildSchedulesBrowseUrl } from '@/lib/schedules-browse-url';
import type { TripSearchLeg, TripType } from '@/lib/trip-types';
import { useLocale, useTranslations } from '@/contexts/locale-context';
import { useCurrency } from '@/contexts/currency-context';

const heroFieldClass =
  'bilan-light-field w-full mt-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-gold';

const heroAirportSelectInputClass =
  'bilan-light-field h-auto min-h-[2.75rem] py-2.5 text-base shadow-none mt-1';

export function HeroSection() {
  const router = useRouter();
  const { isRtl, locale } = useLocale();
  const t = useTranslations();
  const { formatMoney } = useCurrency();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState<TripType>('oneway');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [multiLegs, setMultiLegs] = useState<TripSearchLeg[]>([
    { origin: '', destination: '', date: '' },
    { origin: '', destination: '', date: '' },
  ]);
  const [passengerCounts, setPassengerCounts] = useState<PassengerSearchCounts>({
    ...DEFAULT_PASSENGER_COUNTS,
  });
  const [seatClass, setSeatClass] = useState<SeatClassOption>('Economy');
  const [bookingRef, setBookingRef] = useState('');
  const [loadingAirports, setLoadingAirports] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [returnLegWarning, setReturnLegWarning] = useState(false);
  const [departureSuggestions, setDepartureSuggestions] = useState<NearestFlightDateSuggestion[]>([]);
  const [loadingDepartureSuggestions, setLoadingDepartureSuggestions] = useState(false);
  const [departureSuggestionsChecked, setDepartureSuggestionsChecked] = useState(false);
  const [returnSuggestions, setReturnSuggestions] = useState<NearestFlightDateSuggestion[]>([]);
  const [loadingReturnSuggestions, setLoadingReturnSuggestions] = useState(false);
  const [returnSuggestionsChecked, setReturnSuggestionsChecked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [origins, setOrigins] = useState<AirportOption[]>([]);
  const [destinationsByOrigin, setDestinationsByOrigin] = useState<
    Map<string, Map<string, AirportOption>>
  >(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoadingAirports(true);
    setLoadError('');
    Promise.all([fetchAllRoutes(), getBookingSearchDefaults()])
      .then(([routes, defaults]) => {
        if (cancelled) return;
        const { origins: originList, destinationsByOrigin: destMap } =
          buildAirportOptionsFromRoutes(routes);
        if (originList.length === 0) {
          setLoadError(t.hero.noRoutes);
          setOrigins([]);
          setDestinationsByOrigin(new Map());
          return;
        }
        setOrigins(originList);
        setDestinationsByOrigin(destMap);

        const defaultOrigin =
          originList.find((a) => a.code === defaults.origin_iata)?.code ||
          originList[0].code;
        const dests = destinationsForOrigin(destMap, defaultOrigin);
        const defaultDest =
          dests.find((a) => a.code === defaults.destination_iata)?.code ||
          dests[0]?.code ||
          '';

        setOrigin(defaultOrigin);
        setDestination(defaultDest);
        if (defaults.suggested_date) {
          setDepartureDate(defaults.suggested_date);
          setReturnDate(defaults.suggested_date);
        }
        setMultiLegs([
          { origin: defaultOrigin, destination: defaultDest, date: defaults.suggested_date || '' },
          { origin: defaultDest, destination: defaultOrigin, date: defaults.suggested_date || '' },
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t.hero.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAirports(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const destinationOptions = useMemo(
    () => destinationsForOrigin(destinationsByOrigin, origin),
    [destinationsByOrigin, origin],
  );

  const originSelectOptions = useMemo(() => airportsToSelectOptions(origins), [origins]);
  const destinationSelectOptions = useMemo(
    () => airportsToSelectOptions(destinationOptions),
    [destinationOptions],
  );

  useEffect(() => {
    if (!origin || destinationOptions.length === 0) return;
    if (!destinationOptions.some((d) => d.code === destination)) {
      setDestination(destinationOptions[0].code);
    }
  }, [origin, destinationOptions, destination]);

  const clearSearchFeedback = () => {
    if (searchError) setSearchError('');
    if (returnLegWarning) setReturnLegWarning(false);
    if (departureSuggestions.length) setDepartureSuggestions([]);
    if (loadingDepartureSuggestions) setLoadingDepartureSuggestions(false);
    if (departureSuggestionsChecked) setDepartureSuggestionsChecked(false);
    if (returnSuggestions.length) setReturnSuggestions([]);
    if (loadingReturnSuggestions) setLoadingReturnSuggestions(false);
    if (returnSuggestionsChecked) setReturnSuggestionsChecked(false);
  };

  const seatCount = seatsRequired(passengerCounts);
  const totalPax = totalPassengers(passengerCounts);

  const formatSearchDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-SO' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatDaysOffset = (days: number) => {
    if (days === 1) return t.hero.dayLater;
    if (days === -1) return t.hero.dayEarlier;
    if (days > 1) return t.hero.daysLater.replace('{count}', String(days));
    if (days < -1) return t.hero.daysEarlier.replace('{count}', String(Math.abs(days)));
    return t.hero.sameWeekReturn;
  };

  const formatFromPrice = (amount: number) =>
    t.hero.fromPrice.replace('{price}', formatMoney(Math.round(amount)));

  const loadDepartureDateSuggestions = async (anchorDate?: string) => {
    const anchor = anchorDate || departureDate;
    if (!origin || !destination || !anchor) return;
    setLoadingDepartureSuggestions(true);
    setDepartureSuggestionsChecked(false);
    setDepartureSuggestions([]);
    try {
      const res = await suggestNearestFlightDates({
        origin,
        destination,
        anchor_date: anchor,
        passengers: seatCount,
      });
      setDepartureSuggestions(res.suggestions || []);
    } catch {
      setDepartureSuggestions([]);
    } finally {
      setLoadingDepartureSuggestions(false);
      setDepartureSuggestionsChecked(true);
    }
  };

  const loadReturnDateSuggestions = async (anchorDate?: string) => {
    const anchor = anchorDate || returnDate;
    if (!origin || !destination || !anchor) return;
    setLoadingReturnSuggestions(true);
    setReturnSuggestionsChecked(false);
    setReturnSuggestions([]);
    try {
      const res = await suggestNearestFlightDates({
        origin: destination,
        destination: origin,
        anchor_date: anchor,
        min_date: departureDate,
        passengers: seatCount,
      });
      setReturnSuggestions(res.suggestions || []);
    } catch {
      setReturnSuggestions([]);
    } finally {
      setLoadingReturnSuggestions(false);
      setReturnSuggestionsChecked(true);
    }
  };

  const handleOriginChange = (code: string) => {
    clearSearchFeedback();
    setOrigin(code);
    const dests = destinationsForOrigin(destinationsByOrigin, code);
    if (dests.length > 0) {
      setDestination((prev) =>
        dests.some((d) => d.code === prev) ? prev : dests[0].code,
      );
    } else {
      setDestination('');
    }
  };

  const updateMultiLeg = (index: number, patch: Partial<TripSearchLeg>) => {
    clearSearchFeedback();
    setMultiLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)),
    );
  };

  const handleMultiLegOriginChange = (index: number, code: string) => {
    clearSearchFeedback();
    const dests = destinationsForOrigin(destinationsByOrigin, code);
    setMultiLegs((prev) =>
      prev.map((leg, i) => {
        if (i !== index) return leg;
        const nextDest =
          dests.find((d) => d.code === leg.destination)?.code || dests[0]?.code || '';
        return { ...leg, origin: code, destination: nextDest };
      }),
    );
  };

  const addMultiLeg = () => {
    if (multiLegs.length >= 6) return;
    const last = multiLegs[multiLegs.length - 1];
    setMultiLegs([
      ...multiLegs,
      {
        origin: last?.destination || origin,
        destination: '',
        date: last?.date || departureDate,
      },
    ]);
  };

  const removeMultiLeg = (index: number) => {
    if (multiLegs.length <= 2) return;
    setMultiLegs(multiLegs.filter((_, i) => i !== index));
  };

  const navigateToFlights = (options: Parameters<typeof buildFlightsSearchUrl>[0]) => {
    setSearchError('');
    setReturnLegWarning(false);
    router.push(buildFlightsSearchUrl(options));
  };

  const checkLegFlights = async (
    legOrigin: string,
    legDestination: string,
    legDate: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await findFlights({
      origin: legOrigin,
      destination: legDestination,
      date: legDate,
      passengers: seatCount,
    });
    if (res.error || !res.flights?.length) {
      return { ok: false, error: res.error };
    }
    return { ok: true };
  };

  const runFlightSearch = async (
    checks: Array<{ origin: string; destination: string; date: string }>,
  ): Promise<{ ok: boolean; failedLeg?: number }> => {
    setSearching(true);
    setSearchError('');
    setReturnLegWarning(false);
    try {
      for (let i = 0; i < checks.length; i += 1) {
        const leg = checks[i];
        const result = await checkLegFlights(leg.origin, leg.destination, leg.date);
        if (!result.ok) {
          return { ok: false, failedLeg: i };
        }
      }
      return { ok: true };
    } catch {
      setSearchError(t.hero.searchFailed);
      return { ok: false };
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (tripType === 'multicity') {
      const validLegs = multiLegs.filter((l) => l.origin && l.destination && l.date);
      if (validLegs.length < 2) return;
      const firstLeg = validLegs[0];
      const result = await runFlightSearch([
        {
          origin: firstLeg.origin,
          destination: firstLeg.destination,
          date: firstLeg.date,
        },
      ]);
      if (!result.ok) {
        setSearchError(t.hero.noFlightsFound);
        void loadDepartureDateSuggestions();
        return;
      }
      navigateToFlights({
        tripType: 'multicity',
        origin: firstLeg.origin,
        destination: firstLeg.destination,
        departureDate: firstLeg.date,
        passengerCounts,
        seatClass,
        multiLegs: validLegs,
      });
      return;
    }

    if (!origin || !destination || !departureDate) return;
    if (tripType === 'return' && !returnDate) return;

    if (tripType === 'return') {
      const result = await runFlightSearch([
        { origin, destination, date: departureDate },
        { origin: destination, destination: origin, date: returnDate },
      ]);
      if (!result.ok) {
        if (result.failedLeg === 0) {
          setSearchError(t.hero.noOutboundFlightsFound);
        } else if (result.failedLeg === 1) {
          setReturnLegWarning(true);
          void loadReturnDateSuggestions();
        }
        return;
      }
    } else {
      const result = await runFlightSearch([{ origin, destination, date: departureDate }]);
      if (!result.ok) {
        setSearchError(t.hero.noFlightsFound);
        void loadDepartureDateSuggestions();
        return;
      }
    }

    navigateToFlights({
      tripType,
      origin,
      destination,
      departureDate,
      returnDate: tripType === 'return' ? returnDate : undefined,
      passengerCounts,
      seatClass,
    });
  };

  const applyDepartureSuggestion = async (suggestedDate: string) => {
    setDepartureDate(suggestedDate);
    setSearchError('');
    setDepartureSuggestions([]);
    setLoadingDepartureSuggestions(false);

    if (tripType === 'return') {
      const result = await runFlightSearch([
        { origin, destination, date: suggestedDate },
        { origin: destination, destination: origin, date: returnDate },
      ]);
      if (!result.ok) {
        if (result.failedLeg === 0) {
          setSearchError(t.hero.noOutboundFlightsFound);
          void loadDepartureDateSuggestions(suggestedDate);
        } else if (result.failedLeg === 1) {
          setReturnLegWarning(true);
          void loadReturnDateSuggestions();
        }
        return;
      }
    } else {
      const result = await runFlightSearch([{ origin, destination, date: suggestedDate }]);
      if (!result.ok) {
        setSearchError(t.hero.noFlightsFound);
        void loadDepartureDateSuggestions(suggestedDate);
        return;
      }
    }

    navigateToFlights({
      tripType,
      origin,
      destination,
      departureDate: suggestedDate,
      returnDate: tripType === 'return' ? returnDate : undefined,
      passengerCounts,
      seatClass,
    });
  };

  const proceedWithOutboundOnly = () => {
    navigateToFlights({
      tripType: 'return',
      origin,
      destination,
      departureDate,
      returnDate,
      passengerCounts,
      seatClass,
    });
  };

  const applyReturnSuggestion = async (suggestedDate: string) => {
    setReturnDate(suggestedDate);
    setReturnLegWarning(false);
    setReturnSuggestions([]);
    setLoadingReturnSuggestions(false);

    const result = await runFlightSearch([
      { origin, destination, date: departureDate },
      { origin: destination, destination: origin, date: suggestedDate },
    ]);
    if (!result.ok) {
      if (result.failedLeg === 0) {
        setSearchError(t.hero.noOutboundFlightsFound);
      } else if (result.failedLeg === 1) {
        setReturnLegWarning(true);
        void loadReturnDateSuggestions(suggestedDate);
      }
      return;
    }

    navigateToFlights({
      tripType: 'return',
      origin,
      destination,
      departureDate,
      returnDate: suggestedDate,
      passengerCounts,
      seatClass,
    });
  };

  const handleManageBooking = () => {
    if (bookingRef) {
      router.push(`/manage-booking?pnr=${bookingRef}`);
    }
  };

  const multicityValid =
    multiLegs.filter((l) => l.origin && l.destination && l.date).length >= 2;

  const schedulesBrowseHref = buildSchedulesBrowseUrl(
    tripType === 'multicity'
      ? (() => {
          const validLegs = multiLegs.filter((l) => l.origin && l.destination && l.date);
          const first = validLegs[0];
          const last = validLegs[validLegs.length - 1];
          return {
            origin: first?.origin,
            destination: first?.destination,
            dateFrom: first?.date,
            dateTo: last?.date,
            passengers: totalPax,
            seatClass,
          };
        })()
      : tripType === 'return' && departureDate && returnDate
        ? {
            origin,
            destination,
            dateFrom: departureDate,
            dateTo: returnDate,
            passengers: totalPax,
            seatClass,
          }
        : {
            origin: origin || undefined,
            destination: destination || undefined,
            date: departureDate || undefined,
            passengers: totalPax,
            seatClass,
          },
  );

  const searchDisabled =
    loadingAirports ||
    searching ||
    (tripType === 'multicity'
      ? !multicityValid
      : !origin || !destination || !departureDate || destinationOptions.length === 0) ||
    (tripType === 'return' && !returnDate);

  return (
    <section className="relative min-h-screen bg-navy pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 text-navy-light/10 text-[20rem] font-bold tracking-wider select-none">
          BILAN AIR
        </div>
        <Plane className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-96 h-96 text-navy-light/20 -rotate-12" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className={`grid lg:grid-cols-2 gap-16 items-center ${isRtl ? 'lg:[direction:rtl]' : ''}`}>
          <div className={isRtl ? 'text-right lg:[direction:rtl]' : 'text-left'}>
            <p
              className="bilan-hero-rise text-gold text-xs font-semibold tracking-[0.3em] mb-6"
              style={{ animationDelay: "0.08s" }}
            >
              {t.hero.eyebrow}
            </p>
            <h1
              className="bilan-hero-rise text-cream font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6"
              style={{ animationDelay: "0.18s" }}
            >
              {t.hero.title}{' '}
              <span className="text-gold">{t.hero.titleHighlight}</span>
            </h1>
            <p
              className="bilan-hero-rise text-cream/60 text-lg mb-8 max-w-lg"
              style={{ animationDelay: "0.28s" }}
            >
              {t.hero.subtitle}
            </p>
            <div
              className={`bilan-hero-rise flex flex-wrap gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: "0.36s" }}
            >
              <Button
                onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
                className="bilan-hero-cta bg-gold hover:bg-gold-dark text-navy w-full sm:w-auto"
              >
                {t.hero.searchFlights}
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push('/manage-booking')}
                className="bilan-hero-cta bilan-navy-outline-btn w-full sm:w-auto"
              >
                {t.hero.manageBooking}
              </Button>
            </div>

            <div className={`mt-16 inline-flex items-center gap-2 border border-cream/20 rounded-lg px-6 py-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className="text-gold text-3xl font-serif">
                {origins.length > 0 ? `${origins.length}+` : '—'}
              </span>
              <span className="text-cream/60 text-sm">{t.hero.routesLive}</span>
            </div>
          </div>

          <div
            id="book"
            className="bilan-hero-rise bg-cream rounded-2xl p-8 shadow-2xl"
            style={{ animationDelay: "0.42s" }}
          >
            <div className="mb-6">
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">{t.hero.flightSearch}</p>
              <div className={`flex items-start justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-navy text-2xl font-serif">{t.hero.findFlight}</h2>
                <Link
                  href={schedulesBrowseHref}
                  className={`inline-flex items-center gap-1 text-xs font-semibold text-navy/50 hover:text-gold transition-colors shrink-0 mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}
                  title={t.hero.viewAllSchedules}
                >
                  <span className="hidden sm:inline">{t.hero.viewAllSchedules}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-navy/60 text-sm mt-1">{t.hero.routesHint}</p>
            </div>

            {loadError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {loadError}
              </p>
            )}

            {searchError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 space-y-3">
                <p>{searchError}</p>
                {(loadingDepartureSuggestions ||
                  departureSuggestions.length > 0 ||
                  departureSuggestionsChecked) && (
                  <NearestFlightDatesPanel
                    variant="hero"
                    title={t.hero.nearestDateTitle}
                    loadingLabel={t.hero.findingNearbyDates}
                    emptyLabel={t.hero.noNearbyDates}
                    useDateLabel={(date) =>
                      t.hero.useDepartureDate.replace('{date}', formatSearchDate(date))
                    }
                    formatDaysOffset={formatDaysOffset}
                    formatFlightCount={(count) =>
                      count > 1
                        ? t.hero.flightsAvailable.replace('{count}', String(count))
                        : t.hero.oneFlightAvailable
                    }
                    formatFromPrice={formatFromPrice}
                    suggestions={departureSuggestions}
                    loading={loadingDepartureSuggestions}
                    checked={departureSuggestionsChecked}
                    onSelect={applyDepartureSuggestion}
                  />
                )}
              </div>
            )}

            {returnLegWarning && (
              <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 mb-4 space-y-3">
                <p>
                  {t.hero.returnFlightsNotFound.replace('{date}', formatSearchDate(returnDate))}
                </p>
                <p className="text-amber-800/80">{t.hero.returnFlightsNotFoundHint}</p>

                {(loadingReturnSuggestions ||
                  returnSuggestions.length > 0 ||
                  returnSuggestionsChecked) && (
                  <NearestFlightDatesPanel
                    variant="hero"
                    title={t.hero.nearestReturnTitle}
                    loadingLabel={t.hero.findingNearbyReturnDates}
                    emptyLabel={t.hero.noNearbyReturnDates}
                    useDateLabel={(date) =>
                      t.hero.useReturnDate.replace('{date}', formatSearchDate(date))
                    }
                    formatDaysOffset={formatDaysOffset}
                    formatFlightCount={(count) =>
                      count > 1
                        ? t.hero.flightsAvailable.replace('{count}', String(count))
                        : t.hero.oneFlightAvailable
                    }
                    formatFromPrice={formatFromPrice}
                    suggestions={returnSuggestions}
                    loading={loadingReturnSuggestions}
                    checked={returnSuggestionsChecked}
                    onSelect={applyReturnSuggestion}
                    className={isRtl ? 'items-end' : undefined}
                  />
                )}

                <Button
                  type="button"
                  onClick={proceedWithOutboundOnly}
                  variant="outline"
                  className="w-full border-amber-300 text-navy hover:bg-white"
                >
                  {t.hero.proceedOutboundOnly}
                </Button>
              </div>
            )}

            <TripTypeSelector
              value={tripType}
              onChange={(next) => {
                clearSearchFeedback();
                setTripType(next);
              }}
              className="mb-4"
            />

            <div className="space-y-4">
              {tripType === 'multicity' ? (
                <>
                  {multiLegs.map((leg, index) => {
                    const legDestOptions = destinationsForOrigin(destinationsByOrigin, leg.origin);
                    return (
                      <div
                        key={index}
                        className="rounded-xl border border-navy/10 p-4 space-y-3 bg-white/60"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-navy text-xs font-semibold tracking-wider">
                            {t.hero.flight} {index + 1}
                          </p>
                          {multiLegs.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeMultiLeg(index)}
                              className="text-navy/40 hover:text-red-600"
                              aria-label={`Remove flight ${index + 1}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-navy/60 text-xs font-semibold tracking-wider">
                            {t.hero.from}
                          </label>
                          <SearchableSelect
                            options={airportsToSelectOptions(origins)}
                            value={leg.origin}
                            onValueChange={(code) => handleMultiLegOriginChange(index, code)}
                            placeholder={t.hero.searchPlaceholder}
                            emptyMessage={t.hero.noOrigin}
                            disabled={origins.length === 0 || loadingAirports}
                            isLoading={loadingAirports}
                            clearable={false}
                            inputClassName={heroAirportSelectInputClass}
                          />
                        </div>
                        <div>
                          <label className="text-navy/60 text-xs font-semibold tracking-wider">
                            {t.hero.to}
                          </label>
                          <SearchableSelect
                            options={airportsToSelectOptions(legDestOptions)}
                            value={leg.destination}
                            onValueChange={(code) => updateMultiLeg(index, { destination: code })}
                            placeholder={t.hero.searchPlaceholder}
                            emptyMessage={t.hero.noDestination}
                            disabled={legDestOptions.length === 0 || loadingAirports}
                            isLoading={loadingAirports}
                            clearable={false}
                            inputClassName={heroAirportSelectInputClass}
                          />
                        </div>
                        <div>
                          <label className="text-navy/60 text-xs font-semibold tracking-wider">
                            {t.hero.departure}
                          </label>
                          <input
                            type="date"
                            value={leg.date}
                            onChange={(e) => updateMultiLeg(index, { date: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            className={heroFieldClass}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {multiLegs.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMultiLeg}
                      className="w-full border-navy/20 text-navy"
                    >
                      <Plus className="w-4 h-4 me-2" />
                      {t.hero.addFlight}
                    </Button>
                  )}
                </>
              ) : (
                <>
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">{t.hero.from}</label>
                {loadingAirports ? (
                  <div className="mt-1 flex items-center gap-2 px-4 py-3 text-navy/50 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.hero.loadingAirports}
                  </div>
                ) : (
                  <SearchableSelect
                    options={originSelectOptions}
                    value={origin}
                    onValueChange={handleOriginChange}
                    placeholder={t.hero.searchPlaceholder}
                    emptyMessage={t.hero.noOrigin}
                    disabled={origins.length === 0}
                    clearable={false}
                    inputClassName={heroAirportSelectInputClass}
                  />
                )}
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">{t.hero.to}</label>
                {loadingAirports ? (
                  <div className="mt-1 px-4 py-3 text-navy/50 text-sm">—</div>
                ) : (
                  <SearchableSelect
                    options={destinationSelectOptions}
                    value={destination}
                    onValueChange={(code) => {
                      clearSearchFeedback();
                      setDestination(code);
                    }}
                    placeholder={t.hero.searchPlaceholder}
                    emptyMessage={t.hero.noDestination}
                    disabled={destinationOptions.length === 0}
                    clearable={false}
                    inputClassName={heroAirportSelectInputClass}
                  />
                )}
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {tripType === 'return' ? t.hero.depart : t.hero.departure}
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => {
                    clearSearchFeedback();
                    setDepartureDate(e.target.value);
                    if (returnDate && e.target.value > returnDate) {
                      setReturnDate(e.target.value);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className={heroFieldClass}
                />
              </div>

              {tripType === 'return' && (
                <div>
                  <label className="text-navy/60 text-xs font-semibold tracking-wider">{t.hero.return}</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => {
                      clearSearchFeedback();
                      setReturnDate(e.target.value);
                    }}
                    min={departureDate || new Date().toISOString().split('T')[0]}
                    className={heroFieldClass}
                  />
                </div>
              )}
                </>
              )}

              <FlightSearchPassengersCabin
                counts={passengerCounts}
                onCountsChange={setPassengerCounts}
                seatClass={seatClass}
                onSeatClassChange={setSeatClass}
                variant="hero"
                disabled={loadingAirports || searching}
                labels={{
                  passengers: t.hero.passengers,
                  adults: t.hero.adults,
                  children: t.hero.children,
                  infants: t.hero.infants,
                  infantsHint: t.hero.infantsHint,
                  cabin: t.hero.cabin,
                }}
              />

              <Button
                onClick={handleSearch}
                disabled={searchDisabled}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-6 mt-4 disabled:opacity-50"
              >
                {loadingAirports || searching ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 me-2" />
                )}
                {searching ? t.hero.searching : t.hero.search}
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-navy/10">
              <p className="text-navy/60 text-sm mb-3">{t.hero.alreadyBooked}</p>
              <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Input
                  placeholder={t.hero.bookingRefPlaceholder}
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  className="bilan-light-field flex-1 h-11"
                />
                <Button
                  onClick={handleManageBooking}
                  variant="outline"
                  className="border-navy/20 text-navy hover:bg-navy/5 gap-1"
                >
                  {t.hero.manage} <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
