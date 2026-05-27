'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, CreditCard, Smartphone, Banknote, Check, Loader2 } from 'lucide-react';
import { loadBookingDraft, clearBookingDraft } from '@/lib/booking-store';
import { createBooking, processPayment } from '@/services/airBooking';
import { useCurrency } from '@/contexts/currency-context';

function PaymentContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('cash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const passengerCount = parseInt(searchParams.get('passengers') || '1');

  useEffect(() => {
    const draft = loadBookingDraft();
    if (draft?.payer_phone) setPhoneNumber(draft.payer_phone);
  }, []);

  const handlePayment = async () => {
    const draft = loadBookingDraft();
    if (!draft) {
      setError('Booking session expired. Please start again.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
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

      const created = await createBooking({
        flight_schedule: draft.flightScheduleId,
        payer_name: draft.payer_name,
        payer_email: draft.payer_email,
        payer_phone: draft.payer_phone,
        passengers: bookingPassengers,
      });

      setTotalAmount(created.total_fare);

      const method = paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash';
      await processPayment(created.pnr, method, phoneNumber || undefined);

      clearBookingDraft();
      setSuccess(true);
      setTimeout(() => {
        router.push(`/booking/confirmation?pnr=${encodeURIComponent(created.pnr)}`);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-32 pb-20">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-navy font-serif text-3xl mb-4">Payment Successful!</h1>
            <p className="text-navy/60 mb-8">Redirecting to your confirmation...</p>
            <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" />
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const displayTotal = totalAmount || 280 * passengerCount;

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-cream font-serif text-3xl">Complete Payment</h1>
          <p className="text-cream/60 mt-2">Confirm your booking with Bilan Air</p>
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
            <div
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer ${
                paymentMethod === 'cash' ? 'border-gold' : 'border-navy/10'
              }`}
              onClick={() => setPaymentMethod('cash')}
            >
              <div className="flex items-center gap-4">
                <Banknote className="w-8 h-8 text-gold" />
                <div>
                  <h3 className="text-navy font-semibold">Cash / Agent</h3>
                  <p className="text-navy/60 text-sm">Pay at counter or via agent portal</p>
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
                  <p className="text-navy/60 text-sm mb-4">STK push to your phone</p>
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

          <div className="bg-white rounded-xl p-6 border border-navy/10 h-fit">
            <h3 className="text-navy font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Total
            </h3>
            <p className="text-3xl font-bold text-gold mb-6">{formatMoney(displayTotal)}</p>
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="w-full bg-gold hover:bg-gold-dark text-navy"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Pay & Confirm <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
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
