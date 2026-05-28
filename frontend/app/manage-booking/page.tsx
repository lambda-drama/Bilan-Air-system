'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plane, Calendar, Clock, MapPin, User, AlertCircle, Download } from 'lucide-react';
import {
  fetchBookingDetails,
  cancelBooking,
  processPayment,
  type BookingDetails,
} from '@/services/airBooking';
import { useCurrency } from '@/contexts/currency-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

function ManageBookingContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const initialPnr = searchParams.get('pnr') || '';
  
  const [pnr, setPnr] = useState(initialPnr);
  const debouncedPnr = useDebouncedValue(pnr.trim(), 400);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!debouncedPnr) {
      setBooking(null);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchBookingDetails(debouncedPnr)
      .then((details) => {
        if (!cancelled) setBooking(details);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Booking not found. Please check your reference number.');
          setBooking(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedPnr]);

  const handleSearch = async (searchPnr?: string) => {
    const ref = (searchPnr || pnr).trim();
    if (!ref) {
      setBooking(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const details = await fetchBookingDetails(ref);
      setBooking(details);
    } catch {
      setError('Booking not found. Please check your reference number.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking?.pnr) return;
    if (!confirm('Cancel this booking?')) return;
    setLoading(true);
    try {
      await cancelBooking(booking.pnr);
      await handleSearch(booking.pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel booking');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!booking?.pnr) return;
    setPaying(true);
    setError('');
    try {
      await processPayment(booking.pnr, 'Cash');
      await handleSearch(booking.pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be recorded');
    } finally {
      setPaying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-800';
      case 'Reserved': return 'bg-yellow-100 text-yellow-700';
      case 'Checked In': return 'bg-blue-100 text-blue-700';
      case 'Boarded': return 'bg-navy text-cream';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      {/* Header */}
      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-4 flex items-center gap-3">
            <span className="w-8 h-px bg-gold" />
            MANAGE BOOKING
          </p>
          <h1 className="text-cream font-serif text-4xl">Manage Your Booking</h1>
          <p className="text-cream/60 mt-2">
            View, modify, or cancel your existing booking
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Form */}
        <div className="bg-white rounded-xl p-6 border border-navy/10 mb-8">
          <h2 className="text-navy font-semibold text-lg mb-4">Find Your Booking</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={pnr}
              onChange={(e) => setPnr(e.target.value.toUpperCase())}
              placeholder="Enter booking reference — search updates as you type"
              className="flex-1 pl-9"
              aria-label="Booking reference"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            )}
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Booking Details */}
        {booking && (
          <div className="bg-white rounded-2xl border border-navy/10 overflow-hidden">
            {/* Header */}
            <div className="bg-navy p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-1">BOOKING REFERENCE</p>
                  <p className="text-cream text-2xl font-bold">{booking.pnr}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
            </div>

            {/* Flight Info */}
            <div className="p-6 border-b border-navy/10">
              <div className="flex items-center gap-2 text-gold mb-4">
                <Plane className="w-5 h-5" />
                <span className="font-semibold">{booking.flight.flight_number}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-navy text-2xl font-bold">{booking.flight.departure_time}</p>
                  <p className="text-navy/60 text-sm">{booking.flight.origin}</p>
                </div>
                <Plane className="w-4 h-4 text-gold -rotate-90" />
                <div className="text-center">
                  <p className="text-navy/60 text-sm">{booking.flight.departure_date}</p>
                  <p className="text-navy font-semibold">{booking.flight.destination}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3 border-b border-navy/10">
              <p className="text-sm">
                <span className="text-navy/60">Payment:</span>{' '}
                <span className={`font-medium px-2 py-0.5 rounded ${getStatusColor(booking.payment_status || 'Pending')}`}>
                  {booking.payment_status || 'Pending'}
                </span>
              </p>
              <p className="text-navy font-medium">Passengers</p>
              {booking.passengers.map((p, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-navy/5 pb-2">
                  <span>{p.name}</span>
                  <span className="text-navy/60">Seat {p.seat}</span>
                </div>
              ))}
            </div>

            <div className="bg-navy/5 p-6 flex items-center justify-between">
              <span className="text-navy font-semibold">Total Amount</span>
              <span className="text-gold text-2xl font-bold">{formatMoney(booking.total_fare)}</span>
            </div>

            <div className="p-6 flex flex-wrap gap-4">
              {booking.payment_status === 'Pending' && booking.status !== 'Cancelled' && (
                <Button
                  className="bg-gold hover:bg-gold-dark text-navy"
                  onClick={handlePayNow}
                  disabled={paying || loading}
                >
                  {paying ? 'Processing...' : 'Complete payment'}
                </Button>
              )}
              {booking.status !== 'Cancelled' && (
                <Button
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  onClick={handleCancel}
                  disabled={loading || paying}
                >
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Help */}
        {!booking && !loading && (
          <div className="text-center text-navy/60">
            <p className="mb-2">Need help finding your booking?</p>
            <p className="text-sm">
              Check your email for the confirmation message containing your booking reference number (PNR).
            </p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function ManageBookingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-32 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
        </div>
      </main>
    }>
      <ManageBookingContent />
    </Suspense>
  );
}
