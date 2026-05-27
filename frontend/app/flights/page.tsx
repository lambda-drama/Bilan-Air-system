'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Plane, Clock, Users, ArrowRight, Filter, ChevronDown } from 'lucide-react';
import type { FlightSchedule } from '@/lib/types';
import { findFlights } from '@/services/search';
import { useCurrency } from '@/contexts/currency-context';

function FlightSearchContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [flights, setFlights] = useState<FlightSchedule[]>([]);
  const [priceBySchedule, setPriceBySchedule] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<'Economy' | 'Business' | 'First Class'>('Economy');

  const origin = searchParams.get('origin') || 'NBO';
  const destination = searchParams.get('destination') || 'MGQ';
  const date = searchParams.get('date') || '';
  const passengers = parseInt(searchParams.get('passengers') || '1');

  useEffect(() => {
    if (!date) {
      setLoading(false);
      setFlights([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    findFlights(origin, destination, date, passengers)
      .then((res) => {
        if (res.error) {
          setError(res.error);
          setFlights([]);
          return;
        }
        const prices: Record<string, Record<string, number>> = {};
        const mapped: FlightSchedule[] = (res.flights || []).map((f) => {
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
            base_fare: f.prices?.Economy ?? f.prices?.['Economy'] ?? 0,
          };
        });
        setPriceBySchedule(prices);
        setFlights(mapped);
      })
      .catch((e: Error) => {
        setError(e.message || 'Failed to search flights');
        setFlights([]);
      })
      .finally(() => setLoading(false));
  }, [origin, destination, date, passengers]);

  const getFare = (flight: FlightSchedule) => {
    const prices = priceBySchedule[flight.name];
    if (prices?.[selectedClass] != null) return prices[selectedClass];
    return flight.base_fare || 0;
  };

  const handleSelectFlight = (flight: FlightSchedule) => {
    const params = new URLSearchParams({
      flight: flight.name,
      class: selectedClass,
      passengers: passengers.toString(),
      origin,
      destination,
      date,
    });
    router.push(`/booking/seats?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      {/* Search Summary */}
      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">SEARCH RESULTS</p>
              <h1 className="text-cream font-serif text-3xl">
                {origin} <ArrowRight className="inline w-6 h-6 mx-2" /> {destination}
              </h1>
              <p className="text-cream/60 mt-2">
                {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Select a date'} &middot; {passengers} passenger{passengers > 1 ? 's' : ''}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="border-cream/30 text-cream hover:bg-cream/10"
              onClick={() => router.push('/#book')}
            >
              Modify Search
            </Button>
          </div>
        </div>
      </div>

      {/* Filters & Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Class Filter */}
        <div className="flex items-center gap-4 mb-8">
          <span className="text-navy/60 text-sm">Class:</span>
          {(['Economy', 'Business', 'First Class'] as const).map((cls) => (
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

        {/* Flight Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-navy/60">Searching for available flights...</p>
          </div>
        ) : !date ? (
          <div className="text-center py-20">
            <Plane className="w-16 h-16 text-navy/20 mx-auto mb-4" />
            <h3 className="text-navy text-xl font-semibold mb-2">Choose a departure date</h3>
            <p className="text-navy/60 mb-6">
              Use the flight search on the home page with the correct route and date for your schedule.
            </p>
            <Button
              className="bg-gold hover:bg-gold-dark text-navy"
              onClick={() => router.push('/#book')}
            >
              Open flight search
            </Button>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/#book')}
            >
              Modify search
            </Button>
          </div>
        ) : flights.length === 0 ? (
          <div className="text-center py-20">
            <Plane className="w-16 h-16 text-navy/20 mx-auto mb-4" />
            <h3 className="text-navy text-xl font-semibold mb-2">No flights found</h3>
            <p className="text-navy/60 mb-4">
              No schedules match this route and date, or seats are not available yet.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push('/#book')}
            >
              Modify search
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {flights.map((flight) => (
              <div
                key={flight.name}
                className="bg-white border border-navy/10 rounded-xl p-6 hover:border-gold/50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {/* Flight Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-gold font-semibold">{flight.flight_number}</span>
                      <span className="text-navy/40">|</span>
                      <span className="text-navy/60 text-sm">{flight.aircraft}</span>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      {/* Departure */}
                      <div className="text-center">
                        <p className="text-navy text-2xl font-bold">{flight.departure_time}</p>
                        <p className="text-navy/60 text-sm">{flight.origin_code}</p>
                      </div>

                      {/* Duration */}
                      <div className="flex-1 flex flex-col items-center">
                        <p className="text-navy/40 text-xs mb-2">2h 30m</p>
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 h-px bg-navy/20" />
                          <Plane className="w-4 h-4 text-gold -rotate-90" />
                          <div className="flex-1 h-px bg-navy/20" />
                        </div>
                        <p className="text-navy/40 text-xs mt-2">Direct</p>
                      </div>

                      {/* Arrival */}
                      <div className="text-center">
                        <p className="text-navy text-2xl font-bold">{flight.arrival_time}</p>
                        <p className="text-navy/60 text-sm">{flight.destination_code}</p>
                      </div>
                    </div>
                  </div>

                  {/* Seats & Price */}
                  <div className="flex items-center gap-6 lg:border-l lg:border-navy/10 lg:pl-6">
                    <div className="text-center">
                      <p className="text-navy/60 text-sm flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {flight.available_seats} seats
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-navy text-2xl font-bold">
                        {formatMoney(Math.round(getFare(flight)))}
                      </p>
                      <p className="text-navy/60 text-sm">per person</p>
                    </div>

                    <Button
                      onClick={() => handleSelectFlight(flight)}
                      className="bg-gold hover:bg-gold-dark text-navy font-semibold px-6"
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function FlightsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-32 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
        </div>
      </main>
    }>
      <FlightSearchContent />
    </Suspense>
  );
}
