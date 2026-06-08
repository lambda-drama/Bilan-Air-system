'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  bookingFlowParamsFromSearchParams,
  bookingFlowPath,
} from '@/lib/booking-flow-params';
import { buildFlightsSearchUrl, parseFlightsSearchParams } from '@/lib/flights-search-url';

export type WebsiteBookingStep = 'seats' | 'account' | 'travelers' | 'review';

const ALL_STEPS: { id: WebsiteBookingStep | 'search'; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'seats', label: 'Seats' },
  { id: 'account', label: 'Account' },
  { id: 'travelers', label: 'Travelers' },
  { id: 'review', label: 'Review' },
];

function visibleSteps(enableSeatSelection: boolean) {
  return enableSeatSelection ? ALL_STEPS : ALL_STEPS.filter((s) => s.id !== 'seats');
}

function flightsSearchHref(searchParams: URLSearchParams): string {
  const { tripType, passengers, origin, destination, date, returnDate, searchLegs } =
    parseFlightsSearchParams(searchParams);
  const first = searchLegs[0];
  return buildFlightsSearchUrl({
    tripType,
    origin: origin || first?.origin || '',
    destination: destination || first?.destination || '',
    departureDate: date || first?.date || '',
    returnDate,
    passengers,
    multiLegs: tripType === 'multicity' ? searchLegs : undefined,
    leg: 0,
  });
}

/** Seat step — reset to first leg so travelers can change seats on every flight. */
export function seatsStepHref(searchParams: URLSearchParams): string {
  const params = bookingFlowParamsFromSearchParams(searchParams);
  params.set('leg', '0');
  const q = params.toString();
  return q ? `/booking/seats?${q}` : '/booking/seats';
}

function stepHref(
  stepId: WebsiteBookingStep | 'search',
  searchParams: URLSearchParams,
): string | null {
  switch (stepId) {
    case 'search':
      return flightsSearchHref(searchParams);
    case 'seats':
      return seatsStepHref(searchParams);
    case 'account':
      return bookingFlowPath('/booking/account', searchParams);
    case 'travelers':
      return bookingFlowPath('/booking/passengers', searchParams);
    case 'review':
      return bookingFlowPath('/booking/payment', searchParams);
    default:
      return null;
  }
}

function defaultBackLink(
  current: WebsiteBookingStep,
  searchParams: URLSearchParams,
  enableSeatSelection: boolean,
): { href: string; label: string } {
  switch (current) {
    case 'seats':
      return { href: flightsSearchHref(searchParams), label: 'Back to flight selection' };
    case 'account':
      return enableSeatSelection
        ? { href: seatsStepHref(searchParams), label: 'Back to seat selection' }
        : { href: flightsSearchHref(searchParams), label: 'Back to flight selection' };
    case 'travelers':
      return enableSeatSelection
        ? { href: seatsStepHref(searchParams), label: 'Back to seat selection' }
        : { href: bookingFlowPath('/booking/account', searchParams), label: 'Back to account' };
    case 'review':
      return {
        href: bookingFlowPath('/booking/passengers', searchParams),
        label: 'Back to traveler details',
      };
  }
}

export function WebsiteBookingFlowHeader({
  currentStep,
  searchParams,
  title,
  description,
  enableSeatSelection = true,
}: {
  currentStep: WebsiteBookingStep;
  searchParams: URLSearchParams;
  title: string;
  description?: string;
  enableSeatSelection?: boolean;
}) {
  const steps = visibleSteps(enableSeatSelection);
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const back = defaultBackLink(currentStep, searchParams, enableSeatSelection);

  return (
    <div className="bg-navy pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Booking progress" className="flex flex-wrap items-center gap-2 sm:gap-4 text-cream/60 text-sm mb-4">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isPast = index < currentIndex;
            const href = isPast ? stepHref(step.id, searchParams) : null;

            return (
              <span key={step.id} className="flex items-center gap-2 sm:gap-4">
                {index > 0 && <ArrowRight className="w-4 h-4 shrink-0 hidden sm:block" />}
                {href ? (
                  <Link
                    href={href}
                    className="hover:text-cream transition-colors underline-offset-2 hover:underline"
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span className={isCurrent ? 'text-gold font-medium' : undefined}>{step.label}</span>
                )}
              </span>
            );
          })}
        </nav>

        <Link
          href={back.href}
          className="inline-flex items-center gap-2 text-sm text-cream/70 hover:text-cream mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {back.label}
        </Link>

        <h1 className="text-cream font-serif text-3xl">{title}</h1>
        {description && <p className="text-cream/60 mt-2">{description}</p>}
      </div>
    </div>
  );
}
