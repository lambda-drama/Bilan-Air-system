"use client";

import { useState } from "react";
import { Loader2, Pencil, Ticket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openDeskDocument } from "@/services/desk";
import { confirmBookingOnCredit, type BookingDetails } from "@/services/airBooking";
import type { AirBookingRow } from "@/services/portal";
import { ConfirmActionDialog } from "@/components/portal/confirm-action-dialog";
import { DisabledActionTooltip } from "@/components/portal/disabled-action-tooltip";
import { toast } from "sonner";

type PortalBookingSheetFooterProps = {
  pnr: string;
  detail: BookingDetails | null;
  row: AirBookingRow | undefined;
  onOpenCancel: () => void;
  onConfirmPayment?: () => void;
  onConfirmCreditComplete?: () => void | Promise<void>;
  /** When false, Confirm on Credit stays visible but disabled. */
  allowConfirmOnCredit?: boolean;
  confirmOnCreditDisabledReason?: string | null;
};

export function PortalBookingSheetFooter({
  pnr,
  detail,
  row,
  onOpenCancel,
  onConfirmPayment,
  onConfirmCreditComplete,
  allowConfirmOnCredit = false,
  confirmOnCreditDisabledReason = null,
}: PortalBookingSheetFooterProps) {
  const [confirmingCredit, setConfirmingCredit] = useState(false);
  const [creditConfirmOpen, setCreditConfirmOpen] = useState(false);

  const status =
    detail?.status ?? row?.reservation_status ?? row?.booking_status ?? "";
  const paymentStatus = detail?.payment_status ?? row?.payment_status ?? "";
  const isCancelled = status === "Void" || status === "Cancelled";
  const isUnpaid = paymentStatus !== "Paid" && paymentStatus !== "Refunded";
  const showConfirmOnCredit = !isCancelled && status === "Booked";
  const creditActionDisabled = !allowConfirmOnCredit || confirmingCredit;
  const creditActionTooltip = !allowConfirmOnCredit
    ? confirmOnCreditDisabledReason
    : confirmingCredit
      ? "Confirming on credit…"
      : null;

  const handleConfirmOnCredit = async () => {
    setConfirmingCredit(true);
    try {
      const res = await confirmBookingOnCredit(pnr);
      setCreditConfirmOpen(false);
      toast.success(res.pnr ? `PNR issued: ${res.pnr}` : "Reservation confirmed on credit.");
      await onConfirmCreditComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm on credit failed");
    } finally {
      setConfirmingCredit(false);
    }
  };

  return (
    <>
      <ConfirmActionDialog
        open={creditConfirmOpen}
        onOpenChange={setCreditConfirmOpen}
        title="Confirm on agent credit?"
        description={
          <>
            <p>
              Reservation <span className="font-mono font-medium text-foreground">{pnr}</span> will
              be confirmed on your agent credit account.
            </p>
            <p>A PNR will be issued and the total fare will be deducted from the agent credit limit.</p>
          </>
        }
        confirmLabel="Confirm on credit"
        loading={confirmingCredit}
        onConfirm={handleConfirmOnCredit}
      />

      <div className="grid w-full grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => openDeskDocument("Air Booking", pnr)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        {showConfirmOnCredit && (
          <DisabledActionTooltip
            disabled={creditActionDisabled}
            reason={creditActionTooltip}
          >
            <Button
              variant="secondary"
              className="w-full"
              disabled={creditActionDisabled}
              onClick={() => setCreditConfirmOpen(true)}
            >
              {confirmingCredit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                <>
                  <Ticket className="mr-2 h-4 w-4" />
                  Confirm on Credit (PNR)
                </>
              )}
            </Button>
          </DisabledActionTooltip>
        )}
        {isUnpaid && onConfirmPayment && (
          <Button
            className="bg-gold text-navy hover:bg-gold-dark w-full"
            onClick={onConfirmPayment}
          >
            Confirm payment & invoice
          </Button>
        )}
        {!isCancelled && (
          <Button
            variant="outline"
            className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={onOpenCancel}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel booking
          </Button>
        )}
      </div>
    </>
  );
}
