'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle, Loader2, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrency } from '@/contexts/currency-context';
import type { BookingDetails } from '@/services/airBooking';
import { cn } from '@/lib/utils';

function getStatusColor(status: string) {
  switch (status) {
    case 'Paid':
      return 'bg-green-100 text-green-700';
    case 'Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Reserved':
      return 'bg-yellow-100 text-yellow-700';
    case 'Checked In':
      return 'bg-blue-100 text-blue-700';
    case 'Boarded':
      return 'bg-navy text-cream';
    case 'Cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export type BookingDetailsViewProps = {
  booking: BookingDetails;
  loading?: boolean;
  error?: string;
  paying?: boolean;
  cancelling?: boolean;
  showCheckInLink?: boolean;
  onPay?: () => void;
  onCancel: (reason: string) => Promise<void>;
  className?: string;
};

export function BookingDetailsView({
  booking,
  loading = false,
  error,
  paying = false,
  cancelling = false,
  showCheckInLink = false,
  onPay,
  onCancel,
  className,
}: BookingDetailsViewProps) {
  const { formatMoney } = useCurrency();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const handleConfirmCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Please tell us why you are cancelling this booking.');
      return;
    }
    setCancelError('');
    try {
      await onCancel(reason);
      setShowCancelForm(false);
      setCancelReason('');
    } catch {
      /* parent surfaces API error */
    }
  };

  return (
    <div className={cn('bg-white rounded-2xl border border-navy/10 overflow-hidden', className)}>
      <div className="bg-navy p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-1">
              BOOKING REFERENCE
            </p>
            <p className="text-cream text-2xl font-bold">{booking.pnr}</p>
          </div>
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-medium shrink-0 ${getStatusColor(booking.status)}`}
          >
            {booking.status}
          </span>
        </div>
      </div>

      <div className="p-6 border-b border-navy/10">
        <div className="flex items-center gap-2 text-gold mb-4">
          <Plane className="w-5 h-5" />
          <span className="font-semibold">{booking.flight.flight_number}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-center min-w-0">
            <p className="text-navy text-2xl font-bold">{booking.flight.departure_time}</p>
            <p className="text-navy/60 text-sm truncate">{booking.flight.origin}</p>
          </div>
          <Plane className="w-4 h-4 text-gold -rotate-90 shrink-0" />
          <div className="text-center min-w-0">
            <p className="text-navy/60 text-sm">{booking.flight.departure_date}</p>
            <p className="text-navy font-semibold truncate">{booking.flight.destination}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-3 border-b border-navy/10">
        <p className="text-sm">
          <span className="text-navy/60">Payment:</span>{' '}
          <span
            className={`font-medium px-2 py-0.5 rounded ${getStatusColor(booking.payment_status || 'Pending')}`}
          >
            {booking.payment_status || 'Pending'}
          </span>
        </p>
        <p className="text-navy font-medium">Passengers</p>
        {booking.passengers.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex justify-between text-sm border-b border-navy/5 pb-2 gap-4">
            <span className="text-navy">{p.name}</span>
            <span className="text-navy/60 shrink-0">Seat {p.seat_label || p.seat}</span>
          </div>
        ))}
      </div>

      {booking.status === 'Cancelled' && booking.reason_for_cancel && (
        <div className="px-6 py-4 border-b border-navy/10 bg-red-50/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800 mb-1">
            Cancellation reason
          </p>
          <p className="text-sm text-red-900/90">{booking.reason_for_cancel}</p>
        </div>
      )}

      <div className="bg-navy/5 p-6 flex items-center justify-between">
        <span className="text-navy font-semibold">Total Amount</span>
        <span className="text-gold text-2xl font-bold">{formatMoney(booking.total_fare)}</span>
      </div>

      {(error || cancelError) && (
        <div className="px-6 pt-4 flex items-start gap-2 text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-sm">{error || cancelError}</span>
        </div>
      )}

      {showCancelForm ? (
        <div className="p-6 space-y-4 border-t border-navy/10 bg-cream/40">
          <div>
            <p className="text-navy font-semibold mb-1">Cancel booking</p>
            <p className="text-navy/60 text-sm mb-3">
              Please tell us why you are cancelling. This helps us improve our service.
            </p>
            <Textarea
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                if (cancelError) setCancelError('');
              }}
              placeholder="Reason for cancellation…"
              rows={4}
              className="bilan-light-field min-h-[100px] resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
              onClick={handleConfirmCancel}
              disabled={loading || paying || cancelling || !cancelReason.trim()}
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling…
                </>
              ) : (
                'Confirm cancellation'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason('');
                setCancelError('');
              }}
              disabled={cancelling}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 flex flex-wrap gap-3">
          {showCheckInLink &&
            booking.payment_status === 'Paid' &&
            booking.status !== 'Cancelled' &&
            !['Checked In', 'Boarded'].includes(booking.status) && (
              <Button asChild className="bg-navy hover:bg-navy-light text-cream">
                <Link href={`/check-in?pnr=${encodeURIComponent(booking.pnr)}`}>
                  Check in online
                </Link>
              </Button>
            )}
          {booking.payment_status === 'Pending' && booking.status !== 'Cancelled' && onPay && (
            <Button
              className="bg-gold hover:bg-gold-dark text-navy"
              onClick={onPay}
              disabled={paying || loading || cancelling}
            >
              {paying ? 'Processing…' : 'Complete payment'}
            </Button>
          )}
          {booking.status !== 'Cancelled' && (
            <Button
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => setShowCancelForm(true)}
              disabled={loading || paying || cancelling}
            >
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
