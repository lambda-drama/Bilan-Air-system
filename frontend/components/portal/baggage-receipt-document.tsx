"use client";

import { Plane } from "lucide-react";
import { AgencyPrintLogo, BrandLogo } from "@/components/brand-logo";
import { PrintBarcodeStrip } from "@/components/portal/print-barcode-strip";
import { useCurrency } from "@/contexts/currency-context";
import {
  formatBaggageClock,
  formatBaggageDate,
  type BaggagePrintData,
} from "@/lib/baggage-print";

export function BaggageReceiptDocument({ baggage }: { baggage: BaggagePrintData }) {
  const { formatMoney } = useCurrency();

  return (
    <div className="baggage-print-sheet mx-auto w-full max-w-[820px] bg-white text-navy shadow-lg print:shadow-none">
      <div className="relative flex items-center gap-4 border-b border-navy/10 px-6 py-5">
        <BrandLogo
          className="h-14 w-14 shrink-0 rounded-full"
          alt={baggage.airline_name}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-navy/50">Baggage receipt</p>
          <p className="text-xs text-navy/60">{baggage.airline_tagline}</p>
        </div>
        <PrintBarcodeStrip value={baggage.barcode_data} format="code128" />
        <AgencyPrintLogo
          src={baggage.agency_logo_url}
          className="h-14 w-14 shrink-0 rounded-full object-contain ring-1 ring-navy/10"
          alt="Agency"
        />
      </div>

      <div className="bg-amber-50 px-6 py-3 text-center text-sm font-medium text-amber-900">
        Keep this receipt until you collect your baggage at {baggage.destination_label}
      </div>

      <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">Tracking number</p>
          <p className="font-mono text-2xl font-bold">{baggage.tracking_number}</p>
        </div>
        <div className="text-right text-sm">
          <p>
            Bag <span className="font-bold">{baggage.sequence_no}</span> of{" "}
            <span className="font-bold">{baggage.total_bags}</span>
          </p>
          <p className="text-navy/60">Status: {baggage.status}</p>
        </div>
      </div>

      <div className="mx-6 mb-4 rounded bg-navy/5 px-4 py-3">
        <p className="text-sm font-semibold">{baggage.passenger_name}</p>
        <p className="text-xs text-navy/60">
          PNR {baggage.pnr} · Reservation {baggage.reservation_ref}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 pb-4 text-sm md:grid-cols-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Flight</p>
          <p className="flex items-center gap-1 font-bold">
            <Plane className="h-3.5 w-3.5 text-gold" />
            {baggage.flight_number}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Route</p>
          <p className="font-semibold">
            {baggage.origin_code} → {baggage.destination_code}
          </p>
          <p className="text-xs text-navy/60">
            {baggage.origin_label} to {baggage.destination_label}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Departure</p>
          <p className="font-semibold">{formatBaggageDate(baggage.departure_date)}</p>
          <p className="text-xs text-navy/60">{formatBaggageClock(baggage.departure_time)}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Weight</p>
          <p className="text-xl font-bold text-gold">{baggage.weight_kg} kg</p>
          <p className="text-xs text-navy/60">Allowance {baggage.allowance_kg} kg</p>
        </div>
      </div>

      <div className="mx-6 border-t border-dashed border-navy/20" />

      <div className="grid grid-cols-2 gap-6 px-6 py-5 text-sm">
        <div>
          <p className="mb-2 font-bold">Checked baggage</p>
          <p>{baggage.weight_kg} kg registered on this tag</p>
          {baggage.is_excess ? (
            <p className="mt-1 text-amber-700">Excess baggage — fee applies per airline policy</p>
          ) : (
            <p className="mt-1 text-navy/60">Within included allowance</p>
          )}
        </div>
        <div>
          <p className="mb-2 font-bold">Check-in details</p>
          <p>Checked in: {baggage.checked_in_at || "At airport"}</p>
          {baggage.baggage_fee > 0 ? (
            <p className="mt-1">Excess fee on tag: {formatMoney(baggage.baggage_fee)}</p>
          ) : null}
        </div>
      </div>

      <div className="bg-navy px-6 py-3 text-center text-xs text-cream">
        Present this receipt and your boarding pass to claim baggage at the arrivals belt
      </div>

      <div className="px-6 py-4 text-xs text-navy/70">
        <p className="mb-2 font-semibold text-navy">Important</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Do not pack valuables, cash, or fragile items in checked baggage.</li>
          <li>Report missing or damaged baggage to the baggage service desk before leaving the airport.</li>
          <li>Quote tracking number <span className="font-mono font-semibold">{baggage.tracking_number}</span> when tracing your bag.</li>
        </ul>
      </div>

      <div className="h-4 bg-[repeating-linear-gradient(135deg,#1a2744_0,#1a2744_12px,#c9a227_12px,#c9a227_24px)]" />
    </div>
  );
}
