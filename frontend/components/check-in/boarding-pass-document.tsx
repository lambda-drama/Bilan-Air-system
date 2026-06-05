"use client";

import { Plane } from "lucide-react";
import { PrintBarcodeStrip } from "@/components/portal/print-barcode-strip";
import {
  formatBoardingClock,
  formatBoardingDate,
  type BoardingPassData,
} from "@/lib/boarding-pass";

export function BoardingPassDocument({ pass }: { pass: BoardingPassData }) {
  return (
    <div className="boarding-pass-sheet mx-auto w-full max-w-[820px] overflow-hidden bg-white text-navy shadow-lg print:shadow-none">
      <div className="flex items-center justify-between border-b-2 border-navy bg-navy px-5 py-3 text-cream">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-navy">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.2em]">{pass.airline_name}</p>
            <p className="text-[10px] text-cream/70">{pass.airline_tagline}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
            Boarding pass
          </p>
          <p className="font-mono text-sm font-bold">{pass.booking_ref}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_auto]">
        <div className="border-b border-navy/10 p-5 md:border-b-0 md:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Passenger</p>
          <p className="mt-1 text-2xl font-bold tracking-wide">{pass.passenger_name}</p>
          <p className="mt-1 text-sm text-navy/60">
            {pass.passenger_type} · {pass.seat_class}
          </p>

          <div className="mt-5 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">From</p>
              <p className="text-4xl font-black">{pass.origin_code}</p>
              <p className="max-w-[8rem] text-xs text-navy/60">{pass.origin_label}</p>
            </div>
            <div className="flex flex-1 flex-col items-center px-2">
              <Plane className="h-5 w-5 text-gold" />
              <div className="mt-1 h-px w-full bg-navy/20" />
              <p className="mt-1 text-sm font-bold">{pass.flight_number}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">To</p>
              <p className="text-4xl font-black">{pass.destination_code}</p>
              <p className="max-w-[8rem] text-xs text-navy/60">{pass.destination_label}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border-b border-navy/10 p-5 md:w-44 md:border-b-0">
          <PrintBarcodeStrip value={pass.barcode_data} />
          {pass.ticket_number ? (
            <p className="mt-2 font-mono text-[10px] text-navy/60">{pass.ticket_number}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-navy/10 px-5 py-4 text-sm md:grid-cols-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Seat</p>
          <p className="text-3xl font-black text-gold">{pass.seat}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Gate</p>
          <p className="text-2xl font-bold">{pass.gate}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Zone</p>
          <p className="text-xl font-bold">{pass.zone}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Boarding</p>
          <p className="font-semibold">{formatBoardingClock(pass.boarding_time)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Departure</p>
          <p className="font-semibold">{formatBoardingClock(pass.departure_time)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Date</p>
          <p className="font-semibold">{formatBoardingDate(pass.departure_date)}</p>
        </div>
      </div>

      <div className="bg-navy/5 px-5 py-3 text-center text-xs text-navy/70">
        Gate closes {formatBoardingClock(pass.gate_close_time || pass.departure_time)} · Be at the gate
        30 minutes before departure
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-navy/30 px-5 py-2 text-[10px] text-navy/50">
        <span className="shrink-0 uppercase tracking-wider">Detach stub</span>
        <span className="flex-1 border-t border-dashed border-navy/30" />
      </div>

      <div className="grid grid-cols-4 gap-3 px-5 py-3 text-xs">
        <div>
          <p className="text-navy/50">Passenger</p>
          <p className="font-bold uppercase">{pass.passenger_name}</p>
        </div>
        <div>
          <p className="text-navy/50">Route</p>
          <p className="font-bold">
            {pass.origin_code} → {pass.destination_code}
          </p>
        </div>
        <div>
          <p className="text-navy/50">Flight / Seat</p>
          <p className="font-bold">
            {pass.flight_number} · {pass.seat}
          </p>
        </div>
        <div className="text-right">
          <p className="text-navy/50">Booking</p>
          <p className="font-mono font-bold">{pass.booking_ref}</p>
        </div>
      </div>

      <div className="h-3 bg-[repeating-linear-gradient(135deg,#1a2744_0,#1a2744_10px,#c9a227_10px,#c9a227_20px)]" />
    </div>
  );
}
