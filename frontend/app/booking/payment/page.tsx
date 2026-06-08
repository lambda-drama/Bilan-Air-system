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
import { bookingLookupRef, createBooking, processPayment } from '@/services/airBooking';
import { getPublicBookingSettings } from '@/services/websiteAuth';
import { useCurrency } from '@/contexts/currency-context';
import { useAuth } from '@/contexts/auth-context';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { clearTripContext } from '@/lib/trip-store';
import { useBookingSettings } from '@/hooks/use-booking-settings';
import { WebsiteBookingFlowHeader } from '@/components/website-booking-flow-header';

function PaymentContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { enableSeatSelection } = useBookingSettings();

  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('cash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [holdLabel, setHoldLabel] = useState('15 minutes');
  const draft = loadBookingDraft();
  const legCount = draft?.legs?.length || 1;
  const passengerCount = parseInt(searchParams.get('passengers') || '1', 10);

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

  const buildBookingPayloads = () => {
    const draft = loadBookingDraft();
    if (!draft) return null;

    const legs = draft.legs?.length
      ? draft.legs
      : [
          {
            flightScheduleId: draft.flightScheduleId,
            seatClass: draft.seatClass,
            selectedSeatIds: draft.selectedSeatIds,
            selectedSeatLabels: draft.selectedSeatLabels,
          },
        ];

    return legs.map((leg) => ({
      booking_source: 'online' as const,
      flight_schedule: leg.flightScheduleId,
      seat_class: leg.seatClass,
      payer_name: draft.payer_name,
      payer_email: draft.payer_email,
      payer_phone: draft.payer_phone,
      passengers: draft.passengers.map((p, i) => ({
        passenger_name: p.full_name,
        id_number: p.id_number.trim() || undefined,
        date_of_birth: p.date_of_birth || undefined,
        passenger_type: p.passenger_type,
        seat_number: enableSeatSelection ? leg.selectedSeatIds[i] : undefined,
        phone_number: p.phone_number,
        email: p.email,
        register_profile: true,
      })),
    }));
  };

  const finishWithRefs = (refs: string[], paid: boolean) => {
    clearBookingDraft();
    clearTripContext();
    const q = new URLSearchParams({ ref: refs[0] });
    if (refs.length > 1) q.set('refs', refs.join(','));
    if (!paid) q.set('reserved', '1');
    router.push(`/booking/confirmation?${q.toString()}`);
  };

  const handleReserve = async () => {
    const payloads = buildBookingPayloads();
    if (!payloads?.length) {
      setError('Booking session expired. Please start again from the home page.');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const refs: string[] = [];
      for (const payload of payloads) {
        const created = await createBooking(payload);
        refs.push(created.reservation_ref);
      }
      finishWithRefs(refs, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create booking');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayNow = async () => {
    const payloads = buildBookingPayloads();
    if (!payloads?.length) {
      setError('Booking session expired. Please start again from the home page.');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const refs: string[] = [];
      for (const payload of payloads) {
        const created = await createBooking(payload);
        const method = paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash';
        const paid = await processPayment(
          bookingLookupRef(created),
          method,
          phoneNumber || undefined,
        );
        refs.push((paid.pnr as string) || created.reservation_ref);
      }
      finishWithRefs(refs, true);
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

      <WebsiteBookingFlowHeader
        currentStep="review"
        searchParams={searchParams}
        enableSeatSelection={enableSeatSelection}
        title="Review & confirm"
        description={`Reserve your seats now — pay within ${holdLabel}. Your PNR is issued when payment is confirmed.`}
      />

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
                  <h3 className="text-navy font-semibold text-lg">Reserve your seats</h3>
                  <p className="text-navy/60 text-sm mt-1">
                    We save your reservation and hold seats for about {holdLabel}. You receive a
                    reservation reference now; your PNR is issued after payment.
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
                    Reserve seat
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
              Confirms payment and issues your PNR{legCount > 1 ? 's' : ''} in one step (
              {passengerCount} traveler{passengerCount > 1 ? 's' : ''}
              {legCount > 1 ? ` · ${legCount} flights` : ''}).
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
              — look up your reservation later to pay or view details.
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
