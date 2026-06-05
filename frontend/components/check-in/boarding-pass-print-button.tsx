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
import { BoardingPassDocument } from "@/components/check-in/boarding-pass-document";
import { getBoardingPassPrintData } from "@/services/checkIn";
import type { BoardingPassData } from "@/lib/boarding-pass";
import { toast } from "sonner";

type Props = {
  bookingRef: string;
  passengerIndex?: number;
  passengerRow?: string;
  passengerName?: string;
  passData?: BoardingPassData;
  size?: "sm" | "default";
  className?: string;
};

export function BoardingPassPrintButton({
  bookingRef,
  passengerIndex,
  passengerRow,
  passengerName,
  passData,
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pass, setPass] = useState<BoardingPassData | null>(passData ?? null);

  const loadPass = async () => {
    if (passData) {
      setPass(passData);
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const result = await getBoardingPassPrintData({
        pnr: bookingRef,
        passenger_row: passengerRow,
        passenger_index: passengerIndex,
      });
      setPass(result.boarding_pass);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load boarding pass for printing.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add("printing-boarding-pass");
    const cleanup = () => {
      document.body.classList.remove("printing-boarding-pass");
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
        className={className ?? "shrink-0 gap-1.5"}
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation();
          void loadPass();
        }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        Print boarding pass
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {passengerName ? `Boarding pass — ${passengerName}` : "Boarding pass"}
            </DialogTitle>
          </DialogHeader>
          {pass ? <BoardingPassDocument pass={pass} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={handlePrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && pass && typeof document !== "undefined"
        ? createPortal(
            <div id="boarding-pass-print-root" className="boarding-pass-print-portal" aria-hidden>
              <BoardingPassDocument pass={pass} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
