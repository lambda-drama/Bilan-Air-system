'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Check, Plane, Clock } from 'lucide-react';
import { fetchBookingDetails, type BookingDetails } from '@/services/airBooking';
import { getPublicBookingSettings } from '@/services/websiteAuth';
import { useCurrency } from '@/contexts/currency-context';

function ConfirmationContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const pnr = searchParams.get('pnr') || '';
  const reservedOnly = searchParams.get('reserved') === '1';
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdLabel, setHoldLabel] = useState('');

  useEffect(() => {
    getPublicBookingSettings()
      .then((s) => setHoldLabel(s.hold_label))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!pnr) return;
    fetchBookingDetails(pnr)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [pnr]);

  const isPending =
    reservedOnly || booking?.payment_status === 'Pending' || booking?.status === 'Reserved';

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                isPending ? 'bg-amber-100' : 'bg-green-100'
              }`}
            >
              {isPending ? (
                <Clock className="w-10 h-10 text-amber-700" />
              ) : (
                <Check className="w-10 h-10 text-green-600" />
              )}
            </div>
            <h1 className="text-navy font-serif text-4xl mb-4">
              {isPending ? 'Booking reserved' : 'Booking confirmed'}
            </h1>
            <p className="text-navy/60 text-lg">Your booking reference (PNR)</p>
            <p className="text-gold text-3xl font-bold mt-2">{pnr}</p>
            {isPending && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-6 max-w-lg mx-auto">
                Status: <strong>Reserved</strong> · Payment: <strong>Pending</strong>. Seats are
                held for about {holdLabel || 'the configured hold period'}. Pay before the hold
                expires using Manage Booking or at a Bilan Air office.
              </p>
            )}
          </div>

          {loading ? (
            <p className="text-center text-navy/60">Loading booking details...</p>
          ) : booking ? (
            <div className="bg-white rounded-2xl border border-navy/10 overflow-hidden mb-8">
              <div className="bg-navy p-6">
                <p className="text-gold text-xs tracking-widest mb-1">FLIGHT</p>
                <p className="text-cream text-2xl font-bold">{booking.flight.flight_number}</p>
              </div>
              <div className="p-6 border-b border-navy/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-navy text-2xl font-bold">{booking.flight.departure_time}</p>
                    <p className="text-navy/60 text-sm">{booking.flight.origin}</p>
                  </div>
                  <Plane className="w-6 h-6 text-gold -rotate-90" />
                  <div className="text-right">
                    <p className="text-navy/60 text-sm">{booking.flight.departure_date}</p>
                    <p className="text-navy font-semibold">{booking.flight.destination}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm">
                  <span className="text-navy/60">Booking:</span>{' '}
                  <span className="font-medium">{booking.status}</span>
                  <span className="mx-2">·</span>
                  <span className="text-navy/60">Payment:</span>{' '}
                  <span className="font-medium">{booking.payment_status}</span>
                </p>
                <p className="text-lg font-semibold text-gold">Total: {formatMoney(booking.total_fare)}</p>
                <div>
                  <p className="text-navy font-medium mb-2">Travelers</p>
                  <ul className="space-y-2 text-sm">
                    {booking.passengers.map((p, i) => (
                      <li key={i} className="flex justify-between border-b border-navy/5 pb-2">
                        <span>{p.name}</span>
                        <span className="text-navy/60">Seat {p.seat_label || p.seat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="bg-gold hover:bg-gold-dark text-navy">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/manage-booking?pnr=${encodeURIComponent(pnr)}`}>
                {isPending ? 'Pay or manage booking' : 'Manage Booking'}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream pt-32 text-center">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
