'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Input } from '@/components/ui/input';
import { BookingDetailsView } from '@/components/booking/booking-details-view';
import { Search, AlertCircle } from 'lucide-react';
import {
  fetchBookingDetails,
  cancelBooking,
  processPayment,
  type BookingDetails,
} from '@/services/airBooking';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

function ManageBookingContent() {
  const searchParams = useSearchParams();
  const initialPnr = searchParams.get('pnr') || '';
  
  const [pnr, setPnr] = useState(initialPnr);
  const debouncedPnr = useDebouncedValue(pnr.trim(), 400);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadBooking = async (ref: string) => {
    const trimmed = ref.trim();
    if (!trimmed) {
      setBooking(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const details = await fetchBookingDetails(trimmed);
      setBooking(details);
    } catch {
      setError('Booking not found. Please check your reference number.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!debouncedPnr) {
      setBooking(null);
      setError('');
      setLoading(false);
      return;
    }

    loadBooking(debouncedPnr);
  }, [debouncedPnr]);

  const handleCancel = async (reason: string) => {
    if (!booking?.pnr) return;
    setCancelling(true);
    setError('');
    try {
      await cancelBooking(booking.pnr, reason);
      await loadBooking(booking.pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel booking');
      throw e;
    } finally {
      setCancelling(false);
    }
  };

  const handlePayNow = async () => {
    if (!booking?.pnr) return;
    setPaying(true);
    setError('');
    try {
      await processPayment(booking.pnr, 'Cash');
      await loadBooking(booking.pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be recorded');
    } finally {
      setPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
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
        <div className="bg-white rounded-xl p-6 border border-navy/10 mb-8">
          <h2 className="text-navy font-semibold text-lg mb-4">Find Your Booking</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={pnr}
              onChange={(e) => setPnr(e.target.value.toUpperCase())}
              placeholder="Enter booking reference — search updates as you type"
              className="flex-1 pl-9 bilan-light-field"
              aria-label="Booking reference"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            )}
          </div>
          {error && !booking && (
            <div className="mt-4 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {booking && (
          <BookingDetailsView
            booking={booking}
            loading={loading}
            error={error}
            paying={paying}
            cancelling={cancelling}
            onPay={handlePayNow}
            onCancel={handleCancel}
          />
        )}

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
