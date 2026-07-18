"use client";

import { Plane, Scissors } from "lucide-react";
import { AgencyPrintLogo, BrandLogo } from "@/components/brand-logo";
import { PrintBarcodeStrip } from "@/components/portal/print-barcode-strip";
import {
  formatBaggageClock,
  formatBaggageDate,
  type BaggagePrintData,
} from "@/lib/baggage-print";

export function BaggageTagDocument({ baggage }: { baggage: BaggagePrintData }) {
  return (
    <div className="baggage-print-sheet mx-auto w-full max-w-[340px] bg-white text-navy shadow-lg print:shadow-none">
      <div className="flex items-center gap-2 border-b-2 border-navy bg-navy px-4 py-2 text-cream">
        <BrandLogo className="h-6 w-6 shrink-0 rounded-full" alt={baggage.airline_name} />
        <span className="min-w-0 flex-1 text-xs font-bold tracking-wider">{baggage.airline_name}</span>
        <div className="flex shrink-0 items-center gap-1 text-xs font-semibold">
          <Plane className="h-3.5 w-3.5 text-gold" />
          {baggage.flight_number}
        </div>
        <AgencyPrintLogo
          src={baggage.agency_logo_url}
          className="h-6 w-6 shrink-0 rounded-full bg-white/10 object-contain"
          alt="Agency"
        />
      </div>

      <div className="border-b border-dashed border-navy/25 px-4 py-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-navy/50">Destination</p>
        <p className="mt-1 text-5xl font-black tracking-tight text-navy">{baggage.destination_code}</p>
        <p className="mt-1 text-xs font-medium text-navy/70">{baggage.destination_label}</p>
      </div>

      <div className="space-y-2 border-b border-navy/10 px-4 py-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">Passenger</span>
          <span className="text-right font-bold uppercase tracking-wide">{baggage.passenger_last_name}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">Full name</span>
          <span className="text-right font-medium">{baggage.passenger_name}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">PNR</span>
          <span className="font-mono font-semibold">{baggage.pnr}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">From</span>
          <span className="font-semibold">
            {baggage.origin_code} → {baggage.destination_code}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">Date</span>
          <span>{formatBaggageDate(baggage.departure_date)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-navy/50">Weight</span>
          <span className="text-lg font-bold text-gold">{baggage.weight_kg} kg</span>
        </div>
        {baggage.is_excess ? (
          <p className="text-center text-xs font-semibold text-amber-700">EXCESS BAGGAGE</p>
        ) : null}
      </div>

      <div className="px-4 py-4 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-navy/50">Baggage tag</p>
        <p className="mt-1 font-mono text-xl font-bold">{baggage.tracking_number}</p>
        <p className="mt-1 text-xs text-navy/60">
          Bag {baggage.sequence_no} of {baggage.total_bags}
        </p>
        <div className="mx-auto mt-3 flex justify-center">
          <PrintBarcodeStrip value={baggage.barcode_data} format="code128" />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-navy/30 px-4 py-2 text-[10px] text-navy/50">
        <Scissors className="h-3 w-3 shrink-0" />
        <span className="flex-1 border-t border-dashed border-navy/30" />
        <span className="shrink-0 uppercase tracking-wider">Detach stub below</span>
        <span className="flex-1 border-t border-dashed border-navy/30" />
      </div>

      <div className="bg-navy/5 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Airline stub</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-navy/50">Tag</p>
            <p className="font-mono font-bold">{baggage.tracking_number}</p>
          </div>
          <div className="text-right">
            <p className="text-navy/50">Flight</p>
            <p className="font-bold">{baggage.flight_number}</p>
          </div>
          <div>
            <p className="text-navy/50">Dest</p>
            <p className="text-lg font-black">{baggage.destination_code}</p>
          </div>
          <div className="text-right">
            <p className="text-navy/50">Weight</p>
            <p className="font-bold">{baggage.weight_kg} kg</p>
          </div>
        </div>
        <p className="mt-2 text-center font-bold uppercase tracking-wide">{baggage.passenger_last_name}</p>
        <p className="mt-2 text-center text-[10px] text-navy/50">
          {formatBaggageDate(baggage.departure_date)} · {formatBaggageClock(baggage.departure_time)}
        </p>
      </div>
    </div>
  );
}
