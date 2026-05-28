'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  CreditCard,
  Smartphone,
  Banknote,
  Check,
  Loader2,
  Ticket,
} from 'lucide-react';
import { loadBookingDraft, clearBookingDraft } from '@/lib/booking-store';
import { createBooking, processPayment } from '@/services/airBooking';
import { getPublicBookingSettings } from '@/services/websiteAuth';
import { useCurrency } from '@/contexts/currency-context';
import { useAuth } from '@/contexts/auth-context';
import { bookingFlowPath } from '@/lib/booking-flow-params';

function PaymentContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('cash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [holdLabel, setHoldLabel] = useState('15 minutes');
  const passengerCount = parseInt(searchParams.get('passengers') || '1');

  const accountPath = bookingFlowPath('/booking/account', searchParams);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(accountPath);
    }
  }, [isLoading, isAuthenticated, router, accountPath]);

  useEffect(() => {
    const draft = loadBookingDraft();
    if (draft?.payer_phone) setPhoneNumber(draft.payer_phone);
    getPublicBookingSettings()
      .then((s) => setHoldLabel(s.hold_label))
      .catch(() => {});
  }, []);

  const buildBookingPayload = () => {
    const draft = loadBookingDraft();
    if (!draft) return null;

    const bookingPassengers = draft.passengers.map((p, i) => ({
      passenger_name: p.full_name,
      id_number: p.id_number,
      date_of_birth: p.date_of_birth,
      passenger_type: p.passenger_type,
      seat_number: draft.selectedSeatIds[i],
      phone_number: p.phone_number,
      email: p.email,
      register_profile: true,
    }));

    return {
      booking_source: 'online' as const,
      flight_schedule: draft.flightScheduleId,
      payer_name: draft.payer_name,
      payer_email: draft.payer_email,
      payer_phone: draft.payer_phone,
      passengers: bookingPassengers,
    };
  };

  const finishWithPnr = (pnr: string, paid: boolean) => {
    clearBookingDraft();
    const q = new URLSearchParams({ pnr });
    if (!paid) q.set('reserved', '1');
    router.push(`/booking/confirmation?${q.toString()}`);
  };

  const handleReserve = async () => {
    const payload = buildBookingPayload();
    if (!payload) {
      setError('Booking session expired. Please start again from the home page.');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const created = await createBooking(payload);
      finishWithPnr(created.pnr, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create booking');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayNow = async () => {
    const payload = buildBookingPayload();
    if (!payload) {
      setError('Booking session expired. Please start again from the home page.');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const created = await createBooking(payload);
      const method = paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash';
      await processPayment(created.pnr, method, phoneNumber || undefined);
      finishWithPnr(created.pnr, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-cream font-serif text-3xl">Review & confirm</h1>
          <p className="text-cream/60 mt-2">
            Reserve your seats now — pay within {holdLabel}. Booking status stays{' '}
            <strong>Reserved</strong> until payment is <strong>Paid</strong>.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border-2 border-gold">
              <div className="flex items-start gap-4">
                <Ticket className="w-10 h-10 text-gold shrink-0" />
                <div>
                  <h3 className="text-navy font-semibold text-lg">Reserve & get your PNR</h3>
                  <p className="text-navy/60 text-sm mt-1">
                    We create your booking immediately. Seats are held for about {holdLabel}{' '}
                    (from BA Settings). Payment status is <strong>Pending</strong> until you pay
                    at the counter, via M-Pesa, or on Manage Booking.
                  </p>
                  <Button
                    className="mt-4 bg-gold hover:bg-gold-dark text-navy w-full sm:w-auto"
                    disabled={processing}
                    onClick={handleReserve}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Ticket className="w-4 h-4 mr-2" />
                    )}
                    Reserve seats & get PNR
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-center text-navy/40 text-sm">or pay now</p>

            <div
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer ${
                paymentMethod === 'cash' ? 'border-gold' : 'border-navy/10'
              }`}
              onClick={() => setPaymentMethod('cash')}
            >
              <div className="flex items-center gap-4">
                <Banknote className="w-8 h-8 text-gold" />
                <div>
                  <h3 className="text-navy font-semibold">Cash / pay at office</h3>
                  <p className="text-navy/60 text-sm">Confirm payment now on this booking</p>
                </div>
              </div>
            </div>

            <div
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer ${
                paymentMethod === 'mpesa' ? 'border-gold' : 'border-navy/10'
              }`}
              onClick={() => setPaymentMethod('mpesa')}
            >
              <div className="flex items-start gap-4">
                <Smartphone className="w-8 h-8 text-gold" />
                <div className="flex-1">
                  <h3 className="text-navy font-semibold">M-Pesa</h3>
                  <p className="text-navy/60 text-sm mb-4">Record M-Pesa payment when confirming</p>
                  {paymentMethod === 'mpesa' && (
                    <Input
                      placeholder="254 7XX XXX XXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-navy/10 h-fit sticky top-24">
            <h3 className="text-navy font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Pay now
            </h3>
            <p className="text-sm text-navy/60 mb-4">
              Creates your PNR and marks the booking <strong>Paid</strong> in one step ({passengerCount}{' '}
              traveler{passengerCount > 1 ? 's' : ''}).
            </p>
            <Button
              onClick={handlePayNow}
              disabled={processing}
              variant="outline"
              className="w-full border-navy/20"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Pay & confirm <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <p className="text-xs text-navy/50 mt-4">
              <Link href="/manage-booking" className="underline">
                Manage Booking
              </Link>{' '}
              — look up your PNR later to pay or view details.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream pt-32 text-center">Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
