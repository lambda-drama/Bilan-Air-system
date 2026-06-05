"use client";

import { BoardingPassDocument } from "@/components/check-in/boarding-pass-document";
import { BoardingPassPrintButton } from "@/components/check-in/boarding-pass-print-button";
import type { BoardingPass } from "@/services/checkIn";

export function BoardingPassCard({
  pass,
  bookingRef,
  passengerIndex,
}: {
  pass: BoardingPass;
  bookingRef: string;
  passengerIndex?: number;
}) {
  return (
    <div className="space-y-3 print:break-inside-avoid">
      <BoardingPassDocument pass={pass} />
      <div className="flex justify-end print:hidden">
        <BoardingPassPrintButton
          bookingRef={bookingRef}
          passengerIndex={passengerIndex}
          passengerName={pass.passenger_name}
          passData={pass}
        />
      </div>
    </div>
  );
}
