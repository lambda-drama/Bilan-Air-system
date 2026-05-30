'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, ArrowRight, Search, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAllRoutes, getBookingSearchDefaults } from '@/services/search';
import {
  buildAirportOptionsFromRoutes,
  destinationsForOrigin,
  airportsToSelectOptions,
  type AirportOption,
} from '@/lib/public-flight-airports';
import { cn } from '@/lib/utils';
import { TripTypeSelector } from '@/components/trip-type-selector';
import { SearchableSelect } from '@/components/portal/searchable-select';
import { buildFlightsSearchUrl } from '@/lib/flights-search-url';
import type { TripSearchLeg, TripType } from '@/lib/trip-types';
import { useLocale, useTranslations } from '@/contexts/locale-context';

const heroFieldClass =
  'bilan-light-field w-full mt-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-gold';

const heroAirportSelectInputClass =
  'bilan-light-field h-auto min-h-[2.75rem] py-2.5 text-base shadow-none mt-1';

export function HeroSection() {
  const router = useRouter();
  const { isRtl } = useLocale();
  const t = useTranslations();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState<TripType>('oneway');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [multiLegs, setMultiLegs] = useState<TripSearchLeg[]>([
    { origin: '', destination: '', date: '' },
    { origin: '', destination: '', date: '' },
  ]);
  const [passengers, setPassengers] = useState(1);
  const [bookingRef, setBookingRef] = useState('');
  const [loadingAirports, setLoadingAirports] = useState(true);
  const [loadError, setLoadError] = useState('');
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

  const handleOriginChange = (code: string) => {
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
    setMultiLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)),
    );
  };

  const handleMultiLegOriginChange = (index: number, code: string) => {
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

  const handleSearch = () => {
    if (tripType === 'multicity') {
      const validLegs = multiLegs.filter((l) => l.origin && l.destination && l.date);
      if (validLegs.length < 2) return;
      router.push(
        buildFlightsSearchUrl({
          tripType: 'multicity',
          origin: validLegs[0].origin,
          destination: validLegs[0].destination,
          departureDate: validLegs[0].date,
          passengers,
          multiLegs: validLegs,
        }),
      );
      return;
    }

    if (!origin || !destination || !departureDate) return;
    if (tripType === 'return' && !returnDate) return;

    router.push(
      buildFlightsSearchUrl({
        tripType,
        origin,
        destination,
        departureDate,
        returnDate: tripType === 'return' ? returnDate : undefined,
        passengers,
      }),
    );
  };

  const handleManageBooking = () => {
    if (bookingRef) {
      router.push(`/manage-booking?pnr=${bookingRef}`);
    }
  };

  const multicityValid =
    multiLegs.filter((l) => l.origin && l.destination && l.date).length >= 2;

  const searchDisabled =
    loadingAirports ||
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
              <Button
                variant="ghost"
                onClick={() => router.push('/portal/login')}
                className="bilan-hero-cta bilan-navy-outline-btn hidden md:inline-flex"
              >
                {t.hero.agentLogin}
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
              <h2 className="text-navy text-2xl font-serif">{t.hero.findFlight}</h2>
              <p className="text-navy/60 text-sm mt-1">{t.hero.routesHint}</p>
            </div>

            {loadError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {loadError}
              </p>
            )}

            <TripTypeSelector value={tripType} onChange={setTripType} className="mb-4" />

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
                    onValueChange={setDestination}
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
                    onChange={(e) => setReturnDate(e.target.value)}
                    min={departureDate || new Date().toISOString().split('T')[0]}
                    className={heroFieldClass}
                  />
                </div>
              )}
                </>
              )}

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">{t.hero.passengers}</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={passengers}
                  onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
                  className={heroFieldClass}
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={searchDisabled}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-6 mt-4 disabled:opacity-50"
              >
                {loadingAirports ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 me-2" />
                )}
                {t.hero.search}
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
