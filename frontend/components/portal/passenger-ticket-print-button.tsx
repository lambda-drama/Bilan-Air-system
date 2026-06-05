"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PassengerTicketDocument } from "@/components/portal/passenger-ticket-document";
import { getPassengerTicketPrintData } from "@/services/airBooking";
import type { PassengerTicketData } from "@/lib/passenger-ticket";
import { toast } from "sonner";

type Props = {
  bookingRef: string;
  passengerRow?: string;
  passengerIndex?: number;
  passengerName?: string;
  size?: "sm" | "default";
};

export function PassengerTicketPrintButton({
  bookingRef,
  passengerRow,
  passengerIndex,
  passengerName,
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<PassengerTicketData | null>(null);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const result = await getPassengerTicketPrintData({
        pnr: bookingRef,
        passenger_row: passengerRow,
        passenger_index: passengerIndex,
      });
      setTicket(result.ticket);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load ticket for printing.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add("printing-passenger-ticket");
    const cleanup = () => {
      document.body.classList.remove("printing-passenger-ticket");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="shrink-0 gap-1.5"
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation();
          void loadTicket();
        }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        Print ticket
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {passengerName ? `Ticket — ${passengerName}` : "Passenger ticket"}
            </DialogTitle>
          </DialogHeader>
          {ticket ? <PassengerTicketDocument ticket={ticket} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" className="bg-gold text-navy hover:bg-gold-dark" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && ticket && typeof document !== "undefined"
        ? createPortal(
            <div id="passenger-ticket-print-root" className="passenger-ticket-print-portal" aria-hidden>
              <PassengerTicketDocument ticket={ticket} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
