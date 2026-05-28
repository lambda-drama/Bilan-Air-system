'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { fetchSeatMap, type SeatMapEntry } from '@/services/flightSchedule';
import { bookingFlowPath } from '@/lib/booking-flow-params';

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

  const flightId = searchParams.get('flight') || '';
  const seatClass = searchParams.get('class') || 'Economy';
  const passengers = parseInt(searchParams.get('passengers') || '1');

  useEffect(() => {
    if (!flightId) return;
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
    const params = new URLSearchParams({
      flight: flightId,
      class: seatClass,
      seats: selectedSeats.join(','),
      seatLabels: labels.join(','),
      passengers: passengers.toString(),
      origin: searchParams.get('origin') || '',
      destination: searchParams.get('destination') || '',
      date: searchParams.get('date') || '',
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

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-cream font-serif text-3xl">Select Your Seats</h1>
          <p className="text-cream/60 mt-2">
            {seatClass} &middot; Select {passengers} seat{passengers > 1 ? 's' : ''}
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
            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleContinue}
                disabled={selectedSeats.length !== passengers}
                className="bg-gold hover:bg-gold-dark text-navy"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
