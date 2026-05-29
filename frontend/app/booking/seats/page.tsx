'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { fetchSeatMap, type SeatMapEntry } from '@/services/flightSchedule';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { parseFlightsSearchParams } from '@/lib/flights-search-url';
import { getLegSelection, loadTripContext, upsertLegSelection } from '@/lib/trip-store';
import { tripLegLabel } from '@/lib/trip-types';

interface SeatRow {
  name: string;
  seat_number: string;
  seat_class: string;
  status: string;
}

function SeatSelectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { tripType, passengers, leg, searchLegs } = parseFlightsSearchParams(searchParams);
  const tripCtx = loadTripContext();
  const legSelection = getLegSelection(leg);
  const isMultiLeg = tripType !== 'oneway' && searchLegs.length > 1;

  const flightId =
    legSelection?.flightScheduleId || searchParams.get('flight') || '';
  const seatClass =
    legSelection?.seatClass || searchParams.get('class') || 'Economy';
  const activeLeg = searchLegs[leg] || {
    origin: searchParams.get('origin') || '',
    destination: searchParams.get('destination') || '',
    date: searchParams.get('date') || '',
  };
  const legTitle = tripLegLabel(activeLeg, leg, searchLegs.length || 1);

  useEffect(() => {
    if (!flightId) return;
    setSelectedSeats([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(true);
    fetchSeatMap(flightId)
      .then((map) => {
        const flat: SeatRow[] = [];
        for (const [cls, list] of Object.entries(map)) {
          for (const s of list as SeatMapEntry[]) {
            flat.push({
              name: s.name,
              seat_number: s.seat_number,
              seat_class: cls,
              status: s.status,
            });
          }
        }
        setSeats(flat);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [flightId]);

  const visibleSeats = seats.filter(
    (s) => s.seat_class === seatClass || seatClass === 'Economy',
  );

  const toggleSeat = (seatId: string) => {
    const seat = seats.find((s) => s.name === seatId);
    if (!seat || seat.status !== 'Available') return;

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatId));
    } else if (selectedSeats.length < passengers) {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  const handleContinue = () => {
    if (selectedSeats.length !== passengers) return;
    const labels = selectedSeats.map(
      (id) => seats.find((s) => s.name === id)?.seat_number || id,
    );

    if (isMultiLeg && legSelection) {
      upsertLegSelection({
        ...legSelection,
        selectedSeatIds: selectedSeats,
        selectedSeatLabels: labels,
      });

      const totalLegs = searchLegs.length;
      if (leg < totalLegs - 1) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('leg', String(leg + 1));
        router.push(`/booking/seats?${params.toString()}`);
        return;
      }

      router.push(bookingFlowPath('/booking/account', searchParams));
      return;
    }

    const params = new URLSearchParams({
      trip: tripType,
      flight: flightId,
      class: seatClass,
      seats: selectedSeats.join(','),
      seatLabels: labels.join(','),
      passengers: passengers.toString(),
      origin: activeLeg.origin,
      destination: activeLeg.destination,
      date: activeLeg.date,
    });
    router.push(bookingFlowPath('/booking/account', params));
  };

  const getSeatColor = (seat: SeatRow) => {
    if (seat.status !== 'Available') return 'bg-navy/20 text-navy/30 cursor-not-allowed';
    if (selectedSeats.includes(seat.name)) return 'bg-gold text-navy cursor-pointer';
    return 'bg-cream text-navy hover:bg-navy/10 cursor-pointer border border-navy/20';
  };

  const seatsByRow: Record<number, SeatRow[]> = {};
  visibleSeats.forEach((seat) => {
    const row = parseInt(seat.seat_number, 10);
    if (!seatsByRow[row]) seatsByRow[row] = [];
    seatsByRow[row].push(seat);
  });

  if (isMultiLeg && !legSelection) {
    return (
      <main className="min-h-screen bg-cream pt-32 text-center px-4">
        <p className="text-navy/70 mb-4">Please select your flights before choosing seats.</p>
        <Button onClick={() => router.push('/#book')}>Back to search</Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-cream font-serif text-3xl">Select Your Seats</h1>
          <p className="text-cream/60 mt-2">
            {isMultiLeg && `${legTitle} · `}
            {activeLeg.origin} → {activeLeg.destination} · {seatClass} · Select {passengers} seat
            {passengers > 1 ? 's' : ''}
            {legSelection?.flightNumber ? ` · ${legSelection.flightNumber}` : ''}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center text-navy/60">Loading seat map...</p>
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : (
          <div className="bg-white rounded-xl p-8 border border-navy/10">
            <div className="sticky top-20 z-10 -mx-8 -mt-8 mb-6 px-8 py-4 bg-white/95 backdrop-blur border-b border-navy/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-navy/70">
                {selectedSeats.length}/{passengers} seat{passengers > 1 ? 's' : ''} selected
                {selectedSeats.length > 0 && (
                  <span className="text-navy font-medium">
                    {' '}
                    ·{' '}
                    {selectedSeats
                      .map((id) => seats.find((s) => s.name === id)?.seat_number || id)
                      .join(', ')}
                  </span>
                )}
              </p>
              <Button
                onClick={handleContinue}
                disabled={selectedSeats.length !== passengers}
                className="bg-gold hover:bg-gold-dark text-navy shrink-0 w-full sm:w-auto"
              >
                {isMultiLeg && leg < searchLegs.length - 1 ? (
                  <>Next flight <ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
            <div className="space-y-2">
              {Object.keys(seatsByRow)
                .map(Number)
                .sort((a, b) => a - b)
                .map((row) => (
                  <div key={row} className="flex items-center justify-center gap-2">
                    <span className="w-8 text-navy/40 text-sm">{row}</span>
                    {seatsByRow[row]
                      .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
                      .map((seat) => (
                        <button
                          key={seat.name}
                          type="button"
                          onClick={() => toggleSeat(seat.name)}
                          disabled={seat.status !== 'Available'}
                          className={`w-10 h-10 rounded text-xs font-medium ${getSeatColor(seat)}`}
                        >
                          {seat.seat_number.replace(/^\d+/, '') || seat.seat_number}
                        </button>
                      ))}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function SeatSelectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream pt-32 text-center">Loading...</div>}>
      <SeatSelectionContent />
    </Suspense>
  );
}
