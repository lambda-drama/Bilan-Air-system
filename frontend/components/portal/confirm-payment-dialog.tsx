'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [paidAccount, setPaidAccount] = useState('');

  useEffect(() => {
    if (!open) {
      setOptions(null);
      setError('');
      setModeOfPayment('');
      setPaidAccount('');
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
        const modeRow = data.modes_of_payment.find((m) => m.name === defaultMode);
        const account =
          modeRow?.default_account ||
          data.default_cash_account ||
          data.accounts[0]?.name ||
          '';
        setPaidAccount(account);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load payment options');
      })
      .finally(() => setLoadingOptions(false));
  }, [open]);

  const accountChoices = useMemo(() => {
    if (!options) return [];
    const names = new Set<string>();
    for (const a of options.accounts) {
      if (a.name) names.add(a.name);
    }
    for (const m of options.modes_of_payment) {
      if (m.default_account) names.add(m.default_account);
    }
    if (options.default_cash_account) names.add(options.default_cash_account);
    if (options.default_mpesa_account) names.add(options.default_mpesa_account);
    return Array.from(names).sort();
  }, [options]);

  const handleModeChange = (value: string) => {
    setModeOfPayment(value);
    if (!options) return;
    const modeRow = options.modes_of_payment.find((m) => m.name === value);
    if (modeRow?.default_account) {
      setPaidAccount(modeRow.default_account);
    }
  };

  const handleSubmit = async () => {
    if (!pnr || !modeOfPayment) {
      setError('Select a mode of payment.');
      return;
    }
    if (!paidAccount) {
      setError('Select a bank/cash account.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await confirmPaymentAndInvoice(pnr, modeOfPayment, paidAccount);
      onOpenChange(false);
      onSuccess?.(pnr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment &amp; invoice</DialogTitle>
          <DialogDescription>
            {pnr ? (
              <>
                Booking <span className="font-mono font-medium text-foreground">{pnr}</span>
                {options?.company ? (
                  <> — accounting company <strong>{options.company}</strong></>
                ) : null}
                {options?.remote ? ' (remote accounting site)' : null}
              </>
            ) : (
              'Creates a sales invoice and payment entry, then marks the booking as paid.'
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading accounting options…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="confirm-payment-mode">Mode of payment</Label>
              <Select value={modeOfPayment} onValueChange={handleModeChange}>
                <SelectTrigger id="confirm-payment-mode" className="w-full">
                  <SelectValue placeholder="Select mode of payment" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.modes_of_payment || []).map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                      {m.default_account ? ` → ${m.default_account}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-payment-account">Paid to account</Label>
              <Select value={paidAccount} onValueChange={setPaidAccount}>
                <SelectTrigger id="confirm-payment-account" className="w-full">
                  <SelectValue placeholder="Select bank/cash account" />
                </SelectTrigger>
                <SelectContent>
                  {accountChoices.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Account used on the payment entry for the selected company.
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
            disabled={submitting || loadingOptions || !modeOfPayment || !paidAccount}
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
