"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { BilanFormDialog, FormField } from "@/components/portal/form-dialog";
import { useFormDialogAlerts } from "@/hooks/use-form-dialog-alerts";
import { useCurrency } from "@/contexts/currency-context";
import { cancelBooking } from "@/services/airBooking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export type CancelBookingTarget = {
  name: string;
  pnr?: string | null;
  payer_name?: string;
  payment_status: string;
  total_fare?: number;
  reservation_status?: string;
  booking_status?: string;
};

type CancelBookingDialogProps = {
  open: boolean;
  booking: CancelBookingTarget | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (
    bookingRef: string,
    refund?: {
      return_invoice_number?: string;
      refund_type?: string;
      refund_amount?: number | null;
    } | null,
  ) => void;
};

function isVoided(booking: CancelBookingTarget) {
  const status = booking.reservation_status || booking.booking_status || "";
  return status === "Void" || status === "Cancelled";
}

export function CancelBookingDialog({
  open,
  booking,
  onOpenChange,
  onSuccess,
}: CancelBookingDialogProps) {
  const { formatMoney } = useCurrency();
  const formAlerts = useFormDialogAlerts();
  const [reason, setReason] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bookingRef = useRef<CancelBookingTarget | null>(null);
  if (booking) bookingRef.current = booking;
  const activeBooking = booking ?? bookingRef.current;

  const isPaid = activeBooking?.payment_status === "Paid";

  useEffect(() => {
    if (!open) {
      setReason("");
      setRefundType("full");
      setRefundAmount("");
      formAlerts.clearAlerts();
    }
  }, [open, formAlerts]);

  const handleSubmit = async () => {
    if (!activeBooking || isVoided(activeBooking)) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      formAlerts.showValidation([{ key: "reason", label: "Cancellation reason" }]);
      return;
    }
    if (isPaid && refundType === "partial") {
      const amount = Number(refundAmount);
      if (!refundAmount.trim() || Number.isNaN(amount) || amount <= 0) {
        formAlerts.showValidation([{ key: "refund_amount", label: "Refund amount" }]);
        return;
      }
    }

    formAlerts.clearAlerts();
    setSubmitting(true);
    try {
      const result = await cancelBooking(activeBooking.name, trimmedReason, {
        ...(isPaid
          ? {
              refund_type: refundType,
              refund_amount: refundType === "partial" ? Number(refundAmount) : undefined,
            }
          : {}),
      });
      onOpenChange(false);
      onSuccess?.(activeBooking.name, result.refund ?? null);
      return result;
    } catch (e) {
      formAlerts.setSubmitError(e instanceof Error ? e.message : "Failed to cancel booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BilanFormDialog
      open={open && !!activeBooking}
      onOpenChange={onOpenChange}
      title="Cancel booking"
      description={
        activeBooking
          ? [
              `Reservation ${activeBooking.name}`,
              activeBooking.pnr ? `PNR ${activeBooking.pnr}` : null,
              activeBooking.payer_name || null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      validationErrors={formAlerts.validationErrors}
      submitError={formAlerts.submitError}
      onDismissAlerts={formAlerts.clearAlerts}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim() || !activeBooking || isVoided(activeBooking)}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Confirm cancellation"
            )}
          </Button>
        </>
      }
    >
      {isPaid && (
        <div className="mb-4 space-y-3 rounded-lg border p-3">
          <Label>Refund</Label>
          <p className="text-xs text-muted-foreground">
            Paid booking — a return invoice will be created on the accounting site before the
            booking is voided.
            {activeBooking?.total_fare != null
              ? ` Total fare: ${formatMoney(activeBooking.total_fare)}.`
              : ""}
          </p>
          <RadioGroup
            value={refundType}
            onValueChange={(v) => {
              setRefundType(v as "full" | "partial");
              formAlerts.clearAlerts();
            }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="full" id="booking-refund-full" />
              <Label htmlFor="booking-refund-full" className="font-normal">
                Full refund — return invoice for the full paid amount
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="partial" id="booking-refund-partial" />
              <Label htmlFor="booking-refund-partial" className="font-normal">
                Partial refund — return invoice for a fixed amount
              </Label>
            </div>
          </RadioGroup>
          {refundType === "partial" && (
            <FormField label="Refund amount" required>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={refundAmount}
                onChange={(e) => {
                  setRefundAmount(e.target.value);
                  formAlerts.clearAlerts();
                }}
                placeholder="Amount to credit on the return invoice"
              />
            </FormField>
          )}
        </div>
      )}

      <FormField label="Cancellation reason" required>
        <Textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            formAlerts.clearAlerts();
          }}
          placeholder="Why is this booking being cancelled?"
          rows={4}
          className="min-h-[96px] resize-y"
        />
      </FormField>
    </BilanFormDialog>
  );
}
