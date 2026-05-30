"use client";

import { useState } from "react";
import { Loader2, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { openDeskDocument } from "@/services/desk";
import type { BookingDetails } from "@/services/airBooking";
import type { AirBookingRow } from "@/services/portal";

type PortalBookingSheetFooterProps = {
  pnr: string;
  detail: BookingDetails | null;
  row: AirBookingRow | undefined;
  showCancelForm: boolean;
  onShowCancelForm: (show: boolean) => void;
  onCancelComplete: () => void;
  onConfirmPayment?: () => void;
  processingPayment?: boolean;
  cancelling?: boolean;
  onSubmitCancel: (reason: string) => Promise<void>;
};

export function PortalBookingSheetFooter({
  pnr,
  detail,
  row,
  showCancelForm,
  onShowCancelForm,
  onCancelComplete,
  onConfirmPayment,
  processingPayment,
  cancelling,
  onSubmitCancel,
}: PortalBookingSheetFooterProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const status = detail?.status ?? row?.booking_status ?? "";
  const paymentStatus = detail?.payment_status ?? row?.payment_status ?? "";
  const isCancelled = status === "Cancelled";
  const isUnpaid = paymentStatus !== "Paid" && paymentStatus !== "Refunded";

  const handleConfirmCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Please provide a reason for cancellation.");
      return;
    }
    setCancelError("");
    try {
      await onSubmitCancel(reason);
      setCancelReason("");
      onShowCancelForm(false);
      onCancelComplete();
    } catch {
      /* parent handles toast */
    }
  };

  if (showCancelForm) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">Cancel booking</p>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            A reason is required and will be saved on the booking record.
          </p>
          <Textarea
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError("");
            }}
            placeholder="Reason for cancellation…"
            rows={4}
            className="min-h-[96px] resize-y"
          />
          {cancelError && <p className="text-xs text-destructive mt-2">{cancelError}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={cancelling || !cancelReason.trim()}
            onClick={handleConfirmCancel}
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Confirm cancellation"
            )}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={cancelling}
            onClick={() => {
              onShowCancelForm(false);
              setCancelReason("");
              setCancelError("");
            }}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button
        variant="outline"
        className="flex-1 min-w-[120px]"
        onClick={() => openDeskDocument("Air Booking", pnr)}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
      {!isCancelled && (
        <Button
          variant="outline"
          className="flex-1 min-w-[120px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onShowCancelForm(true)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      )}
      {isUnpaid && onConfirmPayment && (
        <Button
          className="bg-gold text-navy hover:bg-gold-dark flex-1 min-w-[160px]"
          disabled={processingPayment}
          onClick={onConfirmPayment}
        >
          {processingPayment ? "Processing…" : "Confirm payment & invoice"}
        </Button>
      )}
    </div>
  );
}
