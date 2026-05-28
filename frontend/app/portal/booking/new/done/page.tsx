"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { BookingFlowLayout } from "@/components/portal/office-booking/booking-flow-layout";
import { Button } from "@/components/ui/button";
import { clearOfficeBookingDraft } from "@/lib/office-booking-store";
import { useCurrency } from "@/contexts/currency-context";

function DoneContent() {
  const searchParams = useSearchParams();
  const { formatMoney } = useCurrency();
  const pnr = searchParams.get("pnr") || "";
  const paid = searchParams.get("paid") === "1";
  const total = searchParams.get("total");

  useEffect(() => {
    clearOfficeBookingDraft();
  }, []);

  return (
    <BookingFlowLayout title="Booking complete" description="The reservation has been saved.">
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="mb-4 h-14 w-14 text-gold" />
        <p className="text-sm text-muted-foreground">PNR</p>
        <p className="text-2xl font-semibold">{pnr || "—"}</p>
        {total && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{formatMoney(parseFloat(total))}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Payment: {paid ? "Paid — invoice created" : "Pending"}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-center">
        <Button className="bg-gold text-navy hover:bg-gold-dark" asChild>
          <Link href="/portal/booking/new">New office booking</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/portal/bookings">View all bookings</Link>
        </Button>
      </div>
    </BookingFlowLayout>
  );
}

export default function OfficeBookingDonePage() {
  return (
    <Suspense
      fallback={
        <BookingFlowLayout title="Booking complete">
          <p className="text-muted-foreground">Loading...</p>
        </BookingFlowLayout>
      }
    >
      <DoneContent />
    </Suspense>
  );
}
