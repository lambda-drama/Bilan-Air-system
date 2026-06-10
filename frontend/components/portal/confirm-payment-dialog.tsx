'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  confirmPaymentAndInvoice,
  getPaymentConfirmationOptions,
  type PaymentConfirmationOptions,
} from '@/services/airBooking';
import { clearPortalPointerLocks } from '@/lib/portal-pointer-lock';

type ConfirmPaymentDialogProps = {
  open: boolean;
  pnr: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (pnr: string) => void;
};

export function ConfirmPaymentDialog({
  open,
  pnr,
  onOpenChange,
  onSuccess,
}: ConfirmPaymentDialogProps) {
  const [options, setOptions] = useState<PaymentConfirmationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');

  useEffect(() => {
    if (!open) {
      setOptions(null);
      setError('');
      setModeOfPayment('');
      return;
    }

    setLoadingOptions(true);
    getPaymentConfirmationOptions()
      .then((data) => {
        setOptions(data);
        const defaultMode =
          data.default_mode_of_payment ||
          data.modes_of_payment[0]?.name ||
          'Cash';
        setModeOfPayment(defaultMode);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load payment options');
      })
      .finally(() => setLoadingOptions(false));
  }, [open]);

  const handleSubmit = async () => {
    if (!pnr || !modeOfPayment) {
      setError('Select a mode of payment.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await confirmPaymentAndInvoice(pnr, modeOfPayment);
      onOpenChange(false);
      onSuccess?.(pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) clearPortalPointerLocks();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment &amp; invoice</DialogTitle>
          <DialogDescription>
            {pnr ? (
              <>
                Booking <span className="font-mono font-medium text-foreground">{pnr}</span>
                {options?.company ? (
                  <> — company <strong>{options.company}</strong></>
                ) : null}
              </>
            ) : (
              'Creates a sales invoice and payment entry, then marks the booking as paid.'
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payment modes…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="confirm-payment-mode">Mode of payment</Label>
              <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
                <SelectTrigger id="confirm-payment-mode" className="w-full">
                  <SelectValue placeholder="Select mode of payment" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.modes_of_payment || []).map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Paid-to account and price list come from BA Settings defaults.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={submitting || loadingOptions || !modeOfPayment}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Confirm payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
