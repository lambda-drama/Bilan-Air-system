'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BookingDetailsView } from '@/components/booking/booking-details-view';
import {
  cancelBooking,
  fetchBookingDetails,
  processPayment,
  type BookingDetails,
} from '@/services/airBooking';

type BookingDetailsSheetProps = {
  pnr: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function BookingDetailsSheet({
  pnr,
  open,
  onOpenChange,
  onUpdated,
}: BookingDetailsSheetProps) {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const loadBooking = useCallback(async () => {
    if (!pnr) {
      setBooking(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const details = await fetchBookingDetails(pnr);
      setBooking(details);
    } catch {
      setError('Could not load booking details.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [pnr]);

  useEffect(() => {
    if (open && pnr) {
      loadBooking();
    }
    if (!open) {
      setBooking(null);
      setError('');
    }
  }, [open, pnr, loadBooking]);

  const handlePay = async () => {
    if (!booking?.pnr) return;
    setPaying(true);
    setError('');
    try {
      await processPayment(booking.pnr, 'Cash');
      await loadBooking();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be recorded');
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!booking?.pnr) return;
    setCancelling(true);
    setError('');
    try {
      await cancelBooking(booking.pnr, reason);
      await loadBooking();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel booking');
      throw e;
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-cream border-navy/10 p-0 [&>button]:text-navy [&>button]:hover:text-gold"
      >
        <SheetHeader className="border-b border-navy/10 bg-navy px-6 py-5 text-left">
          <SheetTitle className="text-cream font-serif text-xl">Booking details</SheetTitle>
          <SheetDescription className="text-cream/60">
            View your trip, pay, or cancel with a reason
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 sm:p-6">
          {loading && !booking ? (
            <div className="flex flex-col items-center justify-center py-16 text-navy/60">
              <Loader2 className="h-8 w-8 animate-spin text-gold mb-3" />
              Loading booking…
            </div>
          ) : booking ? (
            <BookingDetailsView
              booking={booking}
              loading={loading}
              error={error}
              paying={paying}
              cancelling={cancelling}
              showCheckInLink
              onPay={handlePay}
              onCancel={handleCancel}
            />
          ) : (
            error && <p className="text-sm text-red-600 text-center py-8">{error}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
