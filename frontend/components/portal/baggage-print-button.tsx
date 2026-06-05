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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BaggageTagDocument } from "@/components/portal/baggage-tag-document";
import { BaggageReceiptDocument } from "@/components/portal/baggage-receipt-document";
import { getBaggagePrintData } from "@/services/baggage";
import type { BaggagePrintData, BaggagePrintFormat } from "@/lib/baggage-print";
import { toast } from "sonner";

const FORMAT_LABELS: Record<BaggagePrintFormat, string> = {
  tag: "Luggage tag",
  receipt: "Passenger receipt",
};

type Props = {
  trackingNumber: string;
  passengerName?: string;
};

export function BaggagePrintButton({ trackingNumber, passengerName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<BaggagePrintFormat>("tag");
  const [baggage, setBaggage] = useState<BaggagePrintData | null>(null);

  const loadPrintData = async (nextFormat: BaggagePrintFormat) => {
    setLoading(true);
    try {
      const result = await getBaggagePrintData(trackingNumber);
      setBaggage(result.baggage);
      setFormat(nextFormat);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load baggage print data.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add("printing-baggage-document");
    const cleanup = () => {
      document.body.classList.remove("printing-baggage-document");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const previewTitle =
    format === "tag"
      ? `Luggage tag — ${trackingNumber}`
      : `Baggage receipt — ${passengerName || trackingNumber}`;

  const PrintDocument =
    format === "tag" ? (
      <BaggageTagDocument baggage={baggage!} />
    ) : (
      <BaggageReceiptDocument baggage={baggage!} />
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading}
            onClick={(e) => e.stopPropagation()}
            title="Print baggage"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => void loadPrintData("tag")}>
            Luggage tag (attach to bag)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void loadPrintData("receipt")}>
            Passenger receipt (give to traveler)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            format === "tag"
              ? "max-h-[90vh] max-w-md overflow-y-auto"
              : "max-h-[90vh] max-w-4xl overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {baggage ? PrintDocument : null}
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
              Print {FORMAT_LABELS[format].toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && baggage && typeof document !== "undefined"
        ? createPortal(
            <div id="baggage-print-root" className="baggage-print-portal" aria-hidden>
              {format === "tag" ? (
                <BaggageTagDocument baggage={baggage} />
              ) : (
                <BaggageReceiptDocument baggage={baggage} />
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
