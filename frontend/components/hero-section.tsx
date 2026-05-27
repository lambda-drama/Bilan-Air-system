'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Sample airports - in production this would come from the API
const airports = [
  { code: 'NBO', name: 'Nairobi', city: 'Nairobi', country: 'Kenya' },
  { code: 'MGQ', name: 'Mogadishu', city: 'Mogadishu', country: 'Somalia' },
  { code: 'HGA', name: 'Hargeisa', city: 'Hargeisa', country: 'Somalia' },
  { code: 'BBO', name: 'Bosaso', city: 'Bosaso', country: 'Somalia' },
  { code: 'KIS', name: 'Kisumu', city: 'Kisumu', country: 'Kenya' },
  { code: 'MBA', name: 'Mombasa', city: 'Mombasa', country: 'Kenya' },
  { code: 'JIB', name: 'Djibouti', city: 'Djibouti', country: 'Djibouti' },
  { code: 'ADD', name: 'Addis Ababa', city: 'Addis Ababa', country: 'Ethiopia' },
];

export function HeroSection() {
  const router = useRouter();
  const [origin, setOrigin] = useState('NBO');
  const [destination, setDestination] = useState('MGQ');
  const [departureDate, setDepartureDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [bookingRef, setBookingRef] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams({
      origin,
      destination,
      date: departureDate,
      passengers: passengers.toString(),
    });
    router.push(`/flights?${params.toString()}`);
  };

  const handleManageBooking = () => {
    if (bookingRef) {
      router.push(`/manage-booking?pnr=${bookingRef}`);
    }
  };

  return (
    <section className="relative min-h-screen bg-navy pt-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 text-navy-light/10 text-[20rem] font-bold tracking-wider select-none">
          BILAN AIR
        </div>
        <Plane className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-96 h-96 text-navy-light/20 -rotate-12" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Hero Content */}
          <div className="text-left">
            <p className="text-gold text-xs font-semibold tracking-[0.3em] mb-6">
              NAIROBI &rarr; MOGADISHU
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
                className="bg-gold hover:bg-gold-dark text-navy font-semibold px-8 py-6"
              >
                Search Flights
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/manage-booking')}
                className="border-cream/30 text-cream hover:bg-cream/10 px-8 py-6"
              >
                Manage Booking
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/portal/login')}
                className="border-cream/30 text-cream hover:bg-cream/10 px-8 py-6"
              >
                Agent Login
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 inline-flex items-center gap-2 border border-cream/20 rounded-lg px-6 py-4">
              <span className="text-gold text-3xl font-serif">12+</span>
              <span className="text-cream/60 text-sm">Routes &middot; East Africa</span>
            </div>
          </div>

          {/* Right - Search Form */}
          <div id="book" className="bg-cream rounded-2xl p-8 shadow-2xl">
            <div className="mb-6">
              <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-2">FLIGHT SEARCH</p>
              <h2 className="text-navy text-2xl font-serif">Find your flight</h2>
              <p className="text-navy/60 text-sm mt-1">
                Fare appears only after route, date, and passenger search.
              </p>
            </div>

            <div className="space-y-4">
              {/* Origin */}
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">FROM</label>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white border border-navy/10 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {airports.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.city} ({airport.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">TO</label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white border border-navy/10 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {airports.map((airport) => (
                    <option key={airport.code} value={airport.code}>
                      {airport.city} ({airport.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">DEPARTURE</label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full mt-1 px-4 py-3 bg-white border border-navy/10 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              {/* Passengers */}
              <div>
                <label className="text-navy/60 text-xs font-semibold tracking-wider">PASSENGERS</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={passengers}
                  onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
                  className="w-full mt-1 px-4 py-3 bg-white border border-navy/10 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <Button
                onClick={handleSearch}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-6 mt-4"
              >
                <Search className="w-4 h-4 mr-2" />
                Search Flights
              </Button>
            </div>

            {/* Manage Booking */}
            <div className="mt-8 pt-6 border-t border-navy/10">
              <p className="text-navy/60 text-sm mb-3">Already booked?</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Booking ref (e.g. BA-20261234)"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  className="flex-1"
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
