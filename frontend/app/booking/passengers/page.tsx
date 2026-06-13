'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Loader2 } from 'lucide-react';
import { loadBookingDraft, saveBookingDraft, type BookingLegDraft } from '@/lib/booking-store';
import { bookingFlowPath } from '@/lib/booking-flow-params';
import { useBookingSettings } from '@/hooks/use-booking-settings';
import { WebsiteBookingFlowHeader } from '@/components/website-booking-flow-header';
import { useAuth } from '@/contexts/auth-context';
import { SearchableSelect } from '@/components/portal/searchable-select';
import { parseFlightsSearchParams } from '@/lib/flights-search-url';
import { passengerTypesFromCounts } from '@/lib/passenger-search-counts';
import { loadTripContext } from '@/lib/trip-store';
import { tripLegLabel } from '@/lib/trip-types';
import { PayerIsTravelingToggle } from '@/components/booking/payer-is-traveling-toggle';
import {
  applyPayerToFirstTraveler,
  payerToTravelerContact,
  type PayerContact,
} from '@/lib/payer-traveler-sync';
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
  const { enableSeatSelection } = useBookingSettings();

  const { tripType, searchLegs, passengerCounts, passengers: passengerTotal } =
    parseFlightsSearchParams(searchParams);
  const typeDefaults = passengerTypesFromCounts(passengerCounts);
  const passengerCount = passengerTotal;
  const isSingleTraveler = passengerCount === 1;
  const [submitting, setSubmitting] = useState(false);
  const [payer, setPayer] = useState<PayerContact>({ name: '', email: '', phone: '' });
  const [payerIsTraveling, setPayerIsTraveling] = useState(isSingleTraveler);

  const accountPath = bookingFlowPath('/booking/account', searchParams);

  const [passengers, setPassengers] = useState<PassengerForm[]>(
    Array(passengerCount)
      .fill(null)
      .map((_, i) => ({
        full_name: '',
        id_number: '',
        date_of_birth: '',
        phone_number: '',
        email: '',
        passenger_type: (typeDefaults[i] || 'Adult') as PassengerForm['passenger_type'],
      })),
  );

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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(accountPath);
    }
  }, [isLoading, isAuthenticated, router, accountPath]);

  useEffect(() => {
    const draft = loadBookingDraft();
    if (!draft?.passengers?.length) return;
    if (draft.payer_name || draft.payer_email || draft.payer_phone) {
      setPayer({
        name: draft.payer_name || '',
        email: draft.payer_email || '',
        phone: draft.payer_phone || '',
      });
    }
    if (draft.payerIsTraveling != null) {
      setPayerIsTraveling(draft.payerIsTraveling);
    }
    setPassengers((prev) =>
      prev.map((p, i) => {
        const saved = draft.passengers[i];
        if (!saved) return p;
        return {
          full_name: saved.full_name || p.full_name,
          id_number: saved.id_number || p.id_number,
          date_of_birth: saved.date_of_birth || p.date_of_birth,
          phone_number: saved.phone_number || p.phone_number,
          email: saved.email || p.email,
          passenger_type: saved.passenger_type || p.passenger_type,
        };
      }),
    );
  }, [passengerCount]);

  const applyAccountToPayer = (account?: Awaited<ReturnType<typeof getMyAccount>>) => {
    const profile = account?.passenger;
    return {
      name:
        profile?.full_name || account?.full_name || user?.full_name || payer.name || '',
      email: profile?.email || account?.email || user?.email || payer.email || '',
      phone:
        profile?.phone_number ||
        account?.mobile_no ||
        user?.mobile_no ||
        user?.phone ||
        payer.phone ||
        '',
    };
  };

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    getMyAccount()
      .then((account) => {
        if (cancelled) return;
        const nextPayer = applyAccountToPayer(account);
        setPayer((prev) =>
          prev.name || prev.email || prev.phone ? prev : nextPayer,
        );
        const profile = account.passenger;
        setPassengers((prev) => {
          const hasSaved = prev.some((p) => p.full_name || p.email || p.phone_number);
          if (hasSaved) return prev;
          const base = prev.map((p, i) => {
            if (i !== 0) return p;
            return {
              ...p,
              full_name:
                profile?.full_name || account.full_name || user.full_name || '',
              email: profile?.email || account.email || user.email || '',
              phone_number:
                profile?.phone_number ||
                account.mobile_no ||
                user.mobile_no ||
                user.phone ||
                '',
              id_number: profile?.id_number || '',
              date_of_birth: profile?.date_of_birth || '',
            };
          });
          return isSingleTraveler ? base : applyPayerToFirstTraveler(base, nextPayer);
        });
      })
      .catch(() => {
        if (cancelled) return;
        const nextPayer = applyAccountToPayer();
        setPayer((prev) =>
          prev.name || prev.email || prev.phone ? prev : nextPayer,
        );
        setPassengers((prev) => {
          const hasSaved = prev.some((p) => p.full_name || p.email || p.phone_number);
          if (hasSaved) return prev;
          const base = prev.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  full_name: user.full_name || '',
                  email: user.email || '',
                  phone_number: user.mobile_no || user.phone || '',
                }
              : p,
          );
          return isSingleTraveler ? base : applyPayerToFirstTraveler(base, nextPayer);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [user, passengerCount, isSingleTraveler]);

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const updatePayer = (next: PayerContact) => {
    setPayer(next);
    if (payerIsTraveling || isSingleTraveler) {
      setPassengers(applyPayerToFirstTraveler(passengers, next));
    }
  };

  const setPayerIsTravelingState = (active: boolean) => {
    setPayerIsTraveling(active);
    if (active) {
      setPassengers(applyPayerToFirstTraveler(passengers, payer));
    }
  };

  const payerReady = !!(payer.name.trim() && payer.phone.trim() && payer.email.trim());
  const travelersValid = passengers.every((p, i) => {
    const contact =
      (i === 0 && (payerIsTraveling || isSingleTraveler))
        ? payerToTravelerContact(payer)
        : { full_name: p.full_name, phone_number: p.phone_number, email: p.email };
    return contact.full_name.trim() && contact.phone_number.trim() && contact.email.trim();
  });
  const isValid = (isSingleTraveler || payerReady) && travelersValid;

  const handleContinue = async () => {
    if (!isValid || submitting || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const resolvedPassengers = applyPayerToFirstTraveler(
        passengers,
        isSingleTraveler
          ? {
              name: passengers[0].full_name,
              email: passengers[0].email,
              phone: passengers[0].phone_number,
            }
          : payer,
      );
      const payerForBooking = isSingleTraveler
        ? {
            name: resolvedPassengers[0].full_name,
            email: resolvedPassengers[0].email,
            phone: resolvedPassengers[0].phone_number,
          }
        : payer;
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
        passengers: resolvedPassengers,
        payer_name: payerForBooking.name,
        payer_email: payerForBooking.email,
        payer_phone: payerForBooking.phone,
        payerIsTraveling: isSingleTraveler || payerIsTraveling,
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

      <WebsiteBookingFlowHeader
        currentStep="travelers"
        searchParams={searchParams}
        enableSeatSelection={enableSeatSelection}
        title="Traveler details"
        description={`Signed in as ${user?.email}. ${
          isSingleTraveler
            ? 'You are the payer and traveler — confirm your details below.'
            : `Enter payer details, then each traveler. Use the button if the payer is also Traveler 1.`
        }`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {!isSingleTraveler && (
              <div className="bg-white rounded-xl p-6 border border-navy/10">
                <h3 className="text-navy font-semibold mb-1">Payer</h3>
                <p className="text-navy/60 text-sm mb-4">
                  Person paying for this booking (invoice and confirmation).
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-navy/60 text-sm font-medium">Full name</label>
                    <Input
                      value={payer.name}
                      onChange={(e) => updatePayer({ ...payer, name: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Phone</label>
                    <Input
                      type="tel"
                      value={payer.phone}
                      onChange={(e) => updatePayer({ ...payer, phone: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={payer.email}
                      onChange={(e) => updatePayer({ ...payer, email: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <PayerIsTravelingToggle
                    active={payerIsTraveling}
                    onToggle={setPayerIsTravelingState}
                    label="Payer is also Traveler 1"
                  />
                </div>
              </div>
            )}

            {passengers.map((passenger, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-navy/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-navy font-semibold">
                      {isSingleTraveler ? 'Your details' : `Traveler ${index + 1}`}
                    </h3>
                    <p className="text-navy/60 text-sm">
                      {isSingleTraveler
                        ? 'Payer and traveler'
                        : enableSeatSelection
                          ? `Seat ${displaySeats[index] || seats[index] || '—'}`
                          : `${seatClass} cabin`}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {index === 0 && (payerIsTraveling || isSingleTraveler) && !isSingleTraveler ? (
                    <p className="sm:col-span-2 rounded-md border border-dashed border-navy/15 bg-cream/50 px-3 py-2 text-sm text-navy/70">
                      Name, phone, and email are taken from the payer above.
                    </p>
                  ) : null}
                  {!(index === 0 && payerIsTraveling && !isSingleTraveler) && (
                    <div className="sm:col-span-2">
                      <label className="text-navy/60 text-sm font-medium">Full name (as on ID)</label>
                      <Input
                        value={passenger.full_name}
                        onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-navy/60 text-sm font-medium">ID / passport (optional)</label>
                    <Input
                      value={passenger.id_number}
                      onChange={(e) => updatePassenger(index, 'id_number', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-navy/60 text-sm font-medium">Date of birth (optional)</label>
                    <Input
                      type="date"
                      value={passenger.date_of_birth}
                      onChange={(e) => updatePassenger(index, 'date_of_birth', e.target.value)}
                      className="mt-1"
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
                  {!(index === 0 && payerIsTraveling && !isSingleTraveler) && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-navy/10 sticky top-24">
              <h3 className="text-navy font-semibold text-lg mb-4">Next step</h3>
              <p className="text-sm text-navy/60 mb-4">
                Review your trip and either <strong>reserve your seats</strong> (pay within the
                hold period) or <strong>pay now</strong> to receive your PNR immediately.
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
              <div className="flex flex-col gap-2">
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
