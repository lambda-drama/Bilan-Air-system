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
  type AirportOption,
} from '@/lib/public-flight-airports';
import { cn } from '@/lib/utils';
import { TripTypeSelector } from '@/components/trip-type-selector';
import { buildFlightsSearchUrl } from '@/lib/flights-search-url';
import type { TripSearchLeg, TripType } from '@/lib/trip-types';

const heroFieldClass =
  'bilan-light-field w-full mt-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-gold';

export function HeroSection() {
  const router = useRouter();
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
          setLoadError('No flight routes are available yet. Please check back soon.');
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
          setLoadError('Could not load airports. Please refresh the page.');
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
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="text-left">
            <p className="text-gold text-xs font-semibold tracking-[0.3em] mb-6">
              BOOK YOUR FLIGHT
            </p>
            <h1 className="text-cream font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              Reliable regional travel with{' '}
              <span className="text-gold">Somali pride.</span>
            </h1>
            <p className="text-cream/60 text-lg mb-8 max-w-lg">
              Safe, smooth, and dependable travel across East Africa.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gold hover:bg-gold-dark text-navy font-semibold px-8 py-6 w-full sm:w-auto"
              >
                Search Flights
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/manage-booking')}
                className="border-cream/30 text-cream hover:bg-cream/10 px-8 py-6 w-full sm:w-auto"
              >
                Manage Booking
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/portal/login')}
                className="hidden md:inline-flex border-cream/30 text-cream hover:bg-cream/10 px-8 py-6"
              >
                Agent Login
              </Button>
            </div>

            <div className="mt-16 inline-flex items-center gap-2 border border-cream/20 rounded-lg px-6 py-4">
              <span className="text-gold text-3xl font-serif">
                {origins.length > 0 ? `${origins.length}+` : '—'}
              </span>
              <span className="text-cream/60 text-sm">Departure airports · live routes</span>
            </div>
          </div>

          <div id="book" className="bg-cream rounded-2xl p-8 shadow-2xl">
            <div className="mb-6">
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">FLIGHT SEARCH</p>
              <h2 className="text-navy text-2xl font-serif">Find your flight</h2>
              <p className="text-navy/60 text-sm mt-1">
                From and To lists use airports on your active routes (not sample data).
              </p>
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
                            FLIGHT {index + 1}
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
                            FROM
                          </label>
                          <select
                            value={leg.origin}
                            onChange={(e) => handleMultiLegOriginChange(index, e.target.value)}
                            disabled={origins.length === 0}
                            className={cn(heroFieldClass, 'disabled:opacity-60')}
                          >
                            {origins.map((airport) => (
                              <option key={airport.code} value={airport.code}>
                                {airport.city} ({airport.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-navy/60 text-xs font-semibold tracking-wider">
                            TO
                          </label>
                          <select
                            value={leg.destination}
                            onChange={(e) => updateMultiLeg(index, { destination: e.target.value })}
                            disabled={legDestOptions.length === 0}
                            className={cn(heroFieldClass, 'disabled:opacity-60')}
                          >
                            {legDestOptions.map((airport) => (
                              <option key={airport.code} value={airport.code}>
                                {airport.city} ({airport.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-navy/60 text-xs font-semibold tracking-wider">
                            DEPARTURE
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
                      <Plus className="w-4 h-4 mr-2" />
                      Add another flight
                    </Button>
                  )}
                </>
              ) : (
                <>
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">FROM</label>
                {loadingAirports ? (
                  <div className="mt-1 flex items-center gap-2 px-4 py-3 text-navy/50 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading airports…
                  </div>
                ) : (
                  <select
                    value={origin}
                    onChange={(e) => handleOriginChange(e.target.value)}
                    disabled={origins.length === 0}
                    className={cn(heroFieldClass, 'disabled:opacity-60')}
                  >
                    {origins.map((airport) => (
                      <option key={airport.code} value={airport.code}>
                        {airport.city} ({airport.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">TO</label>
                {loadingAirports ? (
                  <div className="mt-1 px-4 py-3 text-navy/50 text-sm">—</div>
                ) : (
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    disabled={destinationOptions.length === 0}
                    className={cn(heroFieldClass, 'disabled:opacity-60')}
                  >
                    {destinationOptions.map((airport) => (
                      <option key={airport.code} value={airport.code}>
                        {airport.city} ({airport.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">
                  {tripType === 'return' ? 'DEPART' : 'DEPARTURE'}
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
                  <label className="text-navy/60 text-xs font-semibold tracking-wider">RETURN</label>
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
                <label className="text-navy/60 text-xs font-semibold tracking-wider">PASSENGERS</label>
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Search Flights
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-navy/10">
              <p className="text-navy/60 text-sm mb-3">Already booked?</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Booking ref (e.g. BA-00001)"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  className="bilan-light-field flex-1 h-11"
                />
                <Button
                  onClick={handleManageBooking}
                  variant="outline"
                  className="border-navy/20 text-navy hover:bg-navy/5"
                >
                  Manage <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
