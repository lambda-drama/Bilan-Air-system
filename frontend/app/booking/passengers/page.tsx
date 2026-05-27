'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, User } from 'lucide-react';
import { saveBookingDraft } from '@/lib/booking-store';
import { registerPassenger } from '@/services/passenger';
import { useCurrency } from '@/contexts/currency-context';
import { SearchableSelect } from '@/components/portal/searchable-select';

const PASSENGER_TYPE_OPTIONS = [
  { value: 'Adult', label: 'Adult' },
  { value: 'Child', label: 'Child (2-11 years)' },
  { value: 'Infant', label: 'Infant (under 2 years)' },
];

interface PassengerForm {
  full_name: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string;
  passenger_type: 'Adult' | 'Child' | 'Infant';
}

function PassengerDetailsContent() {
  const { formatMoney } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const flightId = searchParams.get('flight') || '';
  const seatClass = searchParams.get('class') || 'Economy';
  const seats = searchParams.get('seats')?.split(',').filter(Boolean) || [];
  const seatLabels = searchParams.get('seatLabels')?.split(',').filter(Boolean) || [];
  const passengerCount = parseInt(searchParams.get('passengers') || '1');
  const [submitting, setSubmitting] = useState(false);

  const [passengers, setPassengers] = useState<PassengerForm[]>(
    Array(passengerCount).fill(null).map(() => ({
      full_name: '',
      id_number: '',
      date_of_birth: '',
      phone_number: '',
      email: '',
      passenger_type: 'Adult' as const,
    }))
  );

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const isValid = passengers.every(
    (p) => p.full_name && p.id_number && p.date_of_birth && p.phone_number && p.email,
  );

  const handleContinue = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const enriched = await Promise.all(
        passengers.map(async (p, i) => {
          try {
            await registerPassenger({
              full_name: p.full_name,
              id_number: p.id_number,
              date_of_birth: p.date_of_birth,
              phone_number: p.phone_number,
              email: p.email,
              passenger_type: p.passenger_type,
            });
          } catch {
            /* may already exist */
          }
          return p;
        }),
      );

      const payer = enriched[0];
      saveBookingDraft({
        flightScheduleId: flightId,
        seatClass,
        selectedSeatIds: seats,
        selectedSeatLabels: seatLabels.length ? seatLabels : seats,
        passengers: enriched,
        payer_name: payer.full_name,
        payer_email: payer.email,
        payer_phone: payer.phone_number,
        origin: searchParams.get('origin') || undefined,
        destination: searchParams.get('destination') || undefined,
        departure_date: searchParams.get('date') || undefined,
      });

      const params = new URLSearchParams({
        flight: flightId,
        class: seatClass,
        seats: seats.join(','),
        passengers: passengerCount.toString(),
      });
      router.push(`/booking/payment?${params.toString()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      
      {/* Header */}
      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 text-cream/60 text-sm mb-4">
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
            <span>Seat Selection</span>
            <ArrowRight className="w-4 h-4" />
            <span className="text-gold">Passenger Details</span>
            <ArrowRight className="w-4 h-4" />
            <span>Payment</span>
          </div>
          <h1 className="text-cream font-serif text-3xl">Passenger Details</h1>
          <p className="text-cream/60 mt-2">
            Enter details for {passengerCount} passenger{passengerCount > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Passenger Forms */}
          <div className="lg:col-span-2 space-y-6">
            {passengers.map((passenger, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-navy/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-navy font-semibold">
                      Passenger {index + 1}
                    </h3>
                    <p className="text-navy/60 text-sm">Seat {seats[index]}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-navy/60 text-sm font-medium">Full Name (as on ID)</label>
                    <Input
                      value={passenger.full_name}
                      onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                      placeholder="John Doe"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">ID/Passport Number</label>
                    <Input
                      value={passenger.id_number}
                      onChange={(e) => updatePassenger(index, 'id_number', e.target.value)}
                      placeholder="A12345678"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Date of Birth</label>
                    <Input
                      type="date"
                      value={passenger.date_of_birth}
                      onChange={(e) => updatePassenger(index, 'date_of_birth', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Passenger Type</label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={PASSENGER_TYPE_OPTIONS}
                        value={passenger.passenger_type}
                        onValueChange={(v) =>
                          updatePassenger(index, 'passenger_type', v as PassengerForm['passenger_type'])
                        }
                        placeholder="Search type..."
                        clearable={false}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Phone Number</label>
                    <Input
                      type="tel"
                      value={passenger.phone_number}
                      onChange={(e) => updatePassenger(index, 'phone_number', e.target.value)}
                      placeholder="+254 700 000 000"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Email Address</label>
                    <Input
                      type="email"
                      value={passenger.email}
                      onChange={(e) => updatePassenger(index, 'email', e.target.value)}
                      placeholder="john@example.com"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-navy/10 sticky top-24">
              <h3 className="text-navy font-semibold text-lg mb-4">Booking Summary</h3>
              
              <div className="space-y-3 mb-6 pb-6 border-b border-navy/10">
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Flight</span>
                  <span className="text-navy font-medium">BA-101</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Route</span>
                  <span className="text-navy font-medium">NBO → MGQ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Class</span>
                  <span className="text-navy font-medium">{seatClass}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Seats</span>
                  <span className="text-navy font-medium">{seats.join(', ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Passengers</span>
                  <span className="text-navy font-medium">{passengerCount}</span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Base Fare × {passengerCount}</span>
                  <span className="text-navy">{formatMoney(250 * passengerCount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-navy/60">Taxes & Fees</span>
                  <span className="text-navy">{formatMoney(30 * passengerCount)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-navy/10">
                  <span className="text-navy">Total</span>
                  <span className="text-gold">{formatMoney(280 * passengerCount)}</span>
                </div>
              </div>

              <Button
                onClick={handleContinue}
                disabled={!isValid}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default function PassengersPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-32 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-gold border-t-transparent rounded-full mx-auto" />
        </div>
      </main>
    }>
      <PassengerDetailsContent />
    </Suspense>
  );
}
