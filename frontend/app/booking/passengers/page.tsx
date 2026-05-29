'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, User, Loader2 } from 'lucide-react';
import { saveBookingDraft, type BookingLegDraft } from '@/lib/booking-store';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { useAuth } from '@/contexts/auth-context';
import { SearchableSelect } from '@/components/portal/searchable-select';
import { parseFlightsSearchParams } from '@/lib/flights-search-url';
import { loadTripContext } from '@/lib/trip-store';
import { tripLegLabel } from '@/lib/trip-types';
import { getMyAccount } from '@/services/websiteAuth';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  const { tripType, searchLegs } = parseFlightsSearchParams(searchParams);
  const tripCtx = loadTripContext();
  const isMultiLeg = tripType !== 'oneway' && (tripCtx?.selections.length || 0) > 1;
  const legSelections = tripCtx?.selections || [];

  const flightId = searchParams.get('flight') || legSelections[0]?.flightScheduleId || '';
  const seatClass = searchParams.get('class') || legSelections[0]?.seatClass || 'Economy';
  const seats = searchParams.get('seats')?.split(',').filter(Boolean) ||
    legSelections[0]?.selectedSeatIds ||
    [];
  const seatLabels = searchParams.get('seatLabels')?.split(',').filter(Boolean) ||
    legSelections[0]?.selectedSeatLabels ||
    [];
  const passengerCount = parseInt(searchParams.get('passengers') || '1');
  const [submitting, setSubmitting] = useState(false);

  const accountPath = bookingFlowPath('/booking/account', searchParams);

  const [passengers, setPassengers] = useState<PassengerForm[]>(
    Array(passengerCount)
      .fill(null)
      .map(() => ({
        full_name: '',
        id_number: '',
        date_of_birth: '',
        phone_number: '',
        email: '',
        passenger_type: 'Adult' as const,
      })),
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(accountPath);
    }
  }, [isLoading, isAuthenticated, router, accountPath]);

  useEffect(() => {
    if (!user || passengerCount !== 1) return;

    let cancelled = false;
    getMyAccount()
      .then((account) => {
        if (cancelled) return;
        const profile = account.passenger;
        setPassengers((prev) =>
          prev.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  full_name:
                    p.full_name ||
                    profile?.full_name ||
                    account.full_name ||
                    user.full_name ||
                    '',
                  email: p.email || profile?.email || account.email || user.email || '',
                  phone_number:
                    p.phone_number ||
                    profile?.phone_number ||
                    account.mobile_no ||
                    user.mobile_no ||
                    user.phone ||
                    '',
                  id_number: p.id_number || profile?.id_number || '',
                  date_of_birth: p.date_of_birth || profile?.date_of_birth || '',
                }
              : p,
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setPassengers((prev) =>
          prev.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  full_name: p.full_name || user.full_name || '',
                  email: p.email || user.email || '',
                  phone_number: p.phone_number || user.mobile_no || user.phone || '',
                }
              : p,
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [user, passengerCount]);

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const isValid = passengers.every(
    (p) => p.full_name && p.id_number && p.date_of_birth && p.phone_number && p.email,
  );

  const handleContinue = async () => {
    if (!isValid || submitting || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const payer = passengers[0];
      const legs: BookingLegDraft[] = isMultiLeg
        ? legSelections.map((sel) => ({
            flightScheduleId: sel.flightScheduleId,
            flightNumber: sel.flightNumber,
            seatClass: sel.seatClass,
            selectedSeatIds: sel.selectedSeatIds,
            selectedSeatLabels: sel.selectedSeatLabels,
            origin: sel.origin,
            destination: sel.destination,
            departure_date: sel.date,
            farePerPerson: sel.farePerPerson,
          }))
        : [
            {
              flightScheduleId: flightId,
              seatClass,
              selectedSeatIds: seats,
              selectedSeatLabels: seatLabels.length ? seatLabels : seats,
              origin: searchParams.get('origin') || undefined,
              destination: searchParams.get('destination') || undefined,
              departure_date: searchParams.get('date') || undefined,
            },
          ];

      const firstLeg = legs[0];
      saveBookingDraft({
        tripType,
        legs,
        flightScheduleId: firstLeg.flightScheduleId,
        seatClass: firstLeg.seatClass,
        selectedSeatIds: firstLeg.selectedSeatIds,
        selectedSeatLabels: firstLeg.selectedSeatLabels,
        passengers,
        payer_name: payer.full_name,
        payer_email: payer.email,
        payer_phone: payer.phone_number,
        origin: firstLeg.origin,
        destination: firstLeg.destination,
        departure_date: firstLeg.departure_date,
        totalFare: legs.reduce(
          (sum, leg) => sum + (leg.farePerPerson || 0) * passengers.length,
          0,
        ),
      });

      router.push(bookingFlowPath('/booking/payment', searchParams));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  const displaySeats = seatLabels.length ? seatLabels : seats;

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      <div className="bg-navy pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 text-cream/60 text-sm mb-4">
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
            <span>Seats</span>
            <ArrowRight className="w-4 h-4" />
            <span>Account</span>
            <ArrowRight className="w-4 h-4" />
            <span className="text-gold">Travelers</span>
          </div>
          <h1 className="text-cream font-serif text-3xl">Traveler details</h1>
          <p className="text-cream/60 mt-2">
            Signed in as {user?.email}.
            {passengerCount === 1
              ? ' Your details are prefilled from your account — confirm or edit below.'
              : ` Enter details for ${passengerCount} travelers.`}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {passengers.map((passenger, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-navy/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-navy font-semibold">Traveler {index + 1}</h3>
                    <p className="text-navy/60 text-sm">Seat {displaySeats[index] || seats[index]}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-navy/60 text-sm font-medium">Full name (as on ID)</label>
                    <Input
                      value={passenger.full_name}
                      onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">ID / passport</label>
                    <Input
                      value={passenger.id_number}
                      onChange={(e) => updatePassenger(index, 'id_number', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Date of birth</label>
                    <Input
                      type="date"
                      value={passenger.date_of_birth}
                      onChange={(e) => updatePassenger(index, 'date_of_birth', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Type</label>
                    <div className="mt-1">
                      <SearchableSelect
                        options={PASSENGER_TYPE_OPTIONS}
                        value={passenger.passenger_type}
                        onValueChange={(v) =>
                          updatePassenger(index, 'passenger_type', v as PassengerForm['passenger_type'])
                        }
                        clearable={false}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Phone</label>
                    <Input
                      type="tel"
                      value={passenger.phone_number}
                      onChange={(e) => updatePassenger(index, 'phone_number', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={passenger.email}
                      onChange={(e) => updatePassenger(index, 'email', e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-navy/10 sticky top-24">
              <h3 className="text-navy font-semibold text-lg mb-4">Next step</h3>
              <p className="text-sm text-navy/60 mb-4">
                Review your trip and either <strong>reserve with a PNR</strong> (pay within the
                hold period) or <strong>pay now</strong> to confirm immediately.
              </p>
              <p className="text-sm text-navy/60 mb-4">
                {isMultiLeg
                  ? `${legSelections.length} flights · ${passengerCount} traveler${passengerCount > 1 ? 's' : ''}`
                  : `Class: ${seatClass} · Seats: ${displaySeats.join(', ')}`}
              </p>
              {isMultiLeg && (
                <ul className="text-sm text-navy/60 mb-6 space-y-2 border-t border-navy/10 pt-4">
                  {legSelections.map((sel, i) => (
                    <li key={i}>
                      <span className="font-medium text-navy">
                        {tripLegLabel(
                          searchLegs[i] || { origin: sel.origin, destination: sel.destination, date: sel.date },
                          i,
                          searchLegs.length,
                        )}
                      </span>
                      <br />
                      {sel.origin} → {sel.destination} · Seats {sel.selectedSeatLabels.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                onClick={handleContinue}
                disabled={!isValid || submitting}
                className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Continue to review'
                )}
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
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream pt-32 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold mx-auto" />
        </main>
      }
    >
      <PassengerDetailsContent />
    </Suspense>
  );
}
