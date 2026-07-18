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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  confirmBookingOnCredit,
  confirmPaymentAndInvoice,
  getPaymentConfirmationOptions,
  type PaymentConfirmationOptions,
} from '@/services/airBooking';
import { clearPortalPointerLocks } from '@/lib/portal-pointer-lock';
import { useCurrency } from '@/contexts/currency-context';

type PaymentPath = 'payment' | 'credit';

type ConfirmPaymentDialogProps = {
  open: boolean;
  pnr: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (pnr: string, method: PaymentPath) => void;
  /** When true, offer agent credit alongside normal payment modes. */
  allowConfirmOnCredit?: boolean;
  confirmOnCreditDisabledReason?: string | null;
  totalFare?: number | null;
};

export function ConfirmPaymentDialog({
  open,
  pnr,
  onOpenChange,
  onSuccess,
  allowConfirmOnCredit = false,
  confirmOnCreditDisabledReason = null,
  totalFare = null,
}: ConfirmPaymentDialogProps) {
  const { formatMoney } = useCurrency();
  const [options, setOptions] = useState<PaymentConfirmationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [paymentPath, setPaymentPath] = useState<PaymentPath>('payment');

  const creditAvailable = allowConfirmOnCredit && !confirmOnCreditDisabledReason;

  useEffect(() => {
    if (!open) {
      setOptions(null);
      setError('');
      setModeOfPayment('');
      setPaymentPath('payment');
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
    if (!pnr) {
      setError('Booking reference is missing.');
      return;
    }

    if (paymentPath === 'credit') {
      if (!creditAvailable) {
        setError(confirmOnCreditDisabledReason || 'Agent credit is not available.');
        return;
      }
      setSubmitting(true);
      setError('');
      try {
        const res = await confirmBookingOnCredit(pnr);
        const displayRef = res.pnr || pnr;
        onSuccess?.(displayRef, 'credit');
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to confirm on credit');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!modeOfPayment) {
      setError('Select a mode of payment.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await confirmPaymentAndInvoice(pnr, modeOfPayment);
      const displayRef = (res as { pnr?: string })?.pnr || pnr;
      onSuccess?.(displayRef, 'payment');
      onOpenChange(false);
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
          <DialogTitle>
            {allowConfirmOnCredit ? 'How do you want to confirm?' : 'Confirm payment & invoice'}
          </DialogTitle>
          <DialogDescription>
            {pnr ? (
              <>
                Booking <span className="font-mono font-medium text-foreground">{pnr}</span>
                {totalFare != null ? (
                  <>
                    {' '}
                    · Total <strong>{formatMoney(totalFare)}</strong>
                  </>
                ) : null}
                {options?.company ? (
                  <> — company <strong>{options.company}</strong></>
                ) : null}
              </>
            ) : allowConfirmOnCredit ? (
              'Choose payment or agent credit to issue the PNR.'
            ) : (
              'Creates a sales invoice and payment entry, then marks the booking as paid.'
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payment options…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {allowConfirmOnCredit ? (
              <RadioGroup
                value={paymentPath}
                onValueChange={(v) => setPaymentPath(v as PaymentPath)}
                className="space-y-3"
              >
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <RadioGroupItem value="payment" id="confirm-path-payment" className="mt-0.5" />
                  <Label htmlFor="confirm-path-payment" className="cursor-pointer font-normal leading-snug">
                    <span className="font-medium">Normal payment</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Collect payment now and create the sales invoice.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <RadioGroupItem
                    value="credit"
                    id="confirm-path-credit"
                    className="mt-0.5"
                    disabled={!creditAvailable}
                  />
                  <Label
                    htmlFor="confirm-path-credit"
                    className={`font-normal leading-snug ${creditAvailable ? 'cursor-pointer' : 'opacity-60'}`}
                  >
                    <span className="font-medium">Agent credit</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {creditAvailable
                        ? 'Confirm on your agent credit account and issue the PNR.'
                        : confirmOnCreditDisabledReason ||
                          'Agent credit is not available for this account.'}
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            ) : null}

            {paymentPath === 'payment' ? (
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
            ) : null}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={
              submitting ||
              loadingOptions ||
              (paymentPath === 'payment' && !modeOfPayment) ||
              (paymentPath === 'credit' && !creditAvailable)
            }
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : paymentPath === 'credit' ? (
              'Confirm on credit'
            ) : (
              'Confirm payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
