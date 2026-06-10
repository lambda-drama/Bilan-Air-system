"use client";

import { Plane } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PrintBarcodeStrip } from "@/components/portal/print-barcode-strip";
import {
  formatTicketClock,
  formatTicketDate,
  type PassengerTicketData,
} from "@/lib/passenger-ticket";

const BAGGAGE_ALLOWANCE_URL = "https://staging-bilan.m.frappe.cloud/laggage";

const BAGGAGE_ALLOWANCE_NOTES = [
  "Allowance is per passenger on this ticket.",
  "Excess baggage is charged per airline policy.",
  "Do not pack valuables, cash, or fragile items in checked baggage.",
] as const;

export function PassengerTicketDocument({ ticket }: { ticket: PassengerTicketData }) {
  const checkedKg = ticket.baggage_policy.checked_kg ?? 23;
  const carryOnKg = ticket.baggage_policy.carry_on_kg ?? 6;
  const checkedPieces = ticket.baggage_policy.checked_pieces ?? 1;
  const carryOnPieces = ticket.baggage_policy.carry_on_pieces ?? 1;

  const countdowns = [
    { num: "3", unit: "hours", desc: "Arrive at the airport before departure" },
    { num: "60", unit: "min", desc: "Check-in counters close before departure" },
    { num: "40", unit: "min", desc: "Boarding begins before departure" },
    { num: "20", unit: "min", desc: "Boarding gates close before departure" },
  ];

  return (
    <div className="passenger-ticket-sheet mx-auto w-full max-w-[760px] overflow-hidden rounded-sm bg-white font-[Barlow,sans-serif] shadow-xl print:shadow-none">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b-2 border-[#0d1f3c] bg-[#f3f4f7] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <BrandLogo
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#e2e6ee]"
            alt={ticket.airline_name}
          />
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#8891a4]">
              E-Ticket · {ticket.airline_tagline}
            </p>
            <p className="font-['Barlow_Condensed',sans-serif] text-[22px] font-extrabold tracking-wide text-[#0d1f3c]">
              {ticket.airline_name}
            </p>
          </div>
        </div>
        <div className="rounded bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-[#e2e6ee]">
          <PrintBarcodeStrip value={ticket.barcode_data} />
        </div>
      </div>

      {/* ── PASSENGER ROW ── */}
      <div className="flex items-center justify-between border-b border-[#e2e6ee] px-5 py-3">
        <h2 className="font-['Barlow_Condensed',sans-serif] text-[18px] font-extrabold tracking-wide text-[#0d1f3c]">
          {ticket.passenger_name}
        </h2>
        <div className="flex items-center gap-0 text-sm">
          {/* Seq No */}
          <div className="pr-4 text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-500">Seq No</p>
            <p className="font-['Barlow_Condensed',sans-serif] text-[13px] font-extrabold text-red-600">
              {String(ticket.sequence_no).padStart(3, "0")}
            </p>
          </div>
          {/* Divider */}
          <div className="h-10 w-px bg-[#d0d4de]" />
          {/* Booking Ref */}
          <div className="pl-4 text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Booking Ref</p>
            <p className="font-['Barlow_Condensed',sans-serif] text-[18px] font-extrabold text-[#0d1f3c]">
              {ticket.booking_ref}
            </p>
          </div>
        </div>
      </div>

      {/* ── TICKET NUMBER BAR ── */}
      <div className="flex border-b border-[#e2e6ee] bg-[#f0f2f7]">
        {/* left quarter — empty spacer */}
        <div className="w-1/4 border-r border-[#e2e6ee]" />
        {/* right three-quarters — ticket number */}
        <div className="flex-1 px-5 py-1.5 text-xs font-semibold tracking-widest text-[#0d1f3c]">
          Ticket &nbsp; {ticket.ticket_number}
        </div>
      </div>

      {/* ── FLIGHT GRID ── */}
      <div className="grid grid-cols-4 gap-0 border-b border-dashed border-[#c8cdd8] px-5 py-4">
        {[
          {
            label: "Flight",
            value: (
              <span className="flex items-center gap-1">
                <Plane className="h-3.5 w-3.5 text-[#c9a227]" />
                {ticket.flight_number}
              </span>
            ),
          },
          { label: "From", value: ticket.origin_label },
          { label: "To", value: ticket.destination_label },
          { label: "Class", value: ticket.seat_class },
        ].map(({ label, value }) => (
          <div key={label} className="pr-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">
              {label}
            </p>
            <p className="font-['Barlow_Condensed',sans-serif] text-[12px] font-bold leading-snug text-[#0d1f3c]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── TIME / SEAT / GATE GRID ── */}
      <div className="grid grid-cols-6 gap-0 border-b border-[#e2e6ee] px-5 py-4">
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Date</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[11px] font-bold leading-snug text-[#0d1f3c]">
            {formatTicketDate(ticket.departure_date)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Seat</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[18px] font-extrabold leading-none text-[#c9a227]">
            {ticket.seat}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Gate</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[12px] font-bold text-[#0d1f3c]">
            {ticket.gate}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Zone</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[12px] font-bold text-[#0d1f3c]">
            {ticket.zone}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Departing</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[12px] font-bold text-[#0d1f3c]">
            {formatTicketClock(ticket.departure_time)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8891a4]">Boarding</p>
          <p className="font-['Barlow_Condensed',sans-serif] text-[12px] font-bold text-[#0d1f3c]">
            {formatTicketClock(ticket.boarding_time)}
          </p>
        </div>
      </div>

      <p className="border-b border-[#e2e6ee] px-5 py-2 text-[11px] text-[#666]">
        Gate closes &nbsp;<strong>{formatTicketClock(ticket.gate_close_time)}</strong>
      </p>

      {/* ── BAGGAGE INFO SEPARATOR ── */}
      <div className="flex border-b border-[#e2e6ee]">
        <div className="w-1/4 shrink-0" />
        <div className="flex-1 border-t border-[#0d1f3c] bg-[#0d1f3c] px-3 py-px text-center leading-none">
          <span className="text-[7px] italic text-white/60">
            For more information about your luggage allowance, visit{" "}
            <a
              href={BAGGAGE_ALLOWANCE_URL}
              className="text-white/75 underline hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              staging-bilan.m.frappe.cloud/laggage
            </a>
          </span>
        </div>
      </div>

      {/* ── BAGGAGE COLUMNS ── */}
      <div className="grid grid-cols-3 divide-x divide-[#e2e6ee] border-b border-[#e2e6ee]">
        <div className="px-4 py-3">
          <p className="mb-1.5 font-['Barlow_Condensed',sans-serif] text-[13px] font-extrabold text-[#0d1f3c]">
            Baggage Allowance
          </p>
          <p className="text-[11px] font-semibold leading-snug text-[#0d1f3c]">
            {ticket.seat_class}: checked {checkedKg} kg ({checkedPieces} bag
            {checkedPieces === 1 ? "" : "s"}) · cabin {carryOnKg} kg ({carryOnPieces} bag
            {carryOnPieces === 1 ? "" : "s"})
          </p>
          <ul className="mt-2 space-y-1 text-[10px] leading-snug text-[#666]">
            {BAGGAGE_ALLOWANCE_NOTES.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
        <div className="px-4 py-3">
          <p className="mb-1.5 font-['Barlow_Condensed',sans-serif] text-[13px] font-extrabold text-[#0d1f3c]">
            Checked Baggage
          </p>
          {/* bag icons */}
          <div className="mb-2 flex items-end gap-2">
            <svg viewBox="0 0 40 44" className="h-10 w-10 fill-[#0d1f3c]" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="12" width="28" height="28" rx="3"/>
              <rect x="14" y="8" width="12" height="6" rx="2" fill="none" stroke="#0d1f3c" strokeWidth="2.5" className="stroke-[#0d1f3c]"/>
              <line x1="20" y1="16" x2="20" y2="40" stroke="white" strokeWidth="1.5"/>
              <line x1="6" y1="28" x2="34" y2="28" stroke="white" strokeWidth="1.5"/>
              <rect x="4" y="20" width="3" height="8" rx="1.5" fill="#8891a4"/>
              <rect x="33" y="20" width="3" height="8" rx="1.5" fill="#8891a4"/>
            </svg>
            <svg viewBox="0 0 40 44" className="h-8 w-8 fill-[#0d1f3c] opacity-60" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="12" width="28" height="28" rx="3"/>
              <rect x="14" y="8" width="12" height="6" rx="2" fill="none" stroke="#0d1f3c" strokeWidth="2.5"/>
              <line x1="20" y1="16" x2="20" y2="40" stroke="white" strokeWidth="1.5"/>
              <line x1="6" y1="28" x2="34" y2="28" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-[11px] text-[#444]">
            {ticket.seat_class}: up to {checkedKg} kg · {checkedPieces} bag
            {checkedPieces === 1 ? "" : "s"}
          </p>
          <p className="text-[10px] text-[#888]">95 × 75 × 45 cm &nbsp;/&nbsp; 38 × 30 × 18 in</p>
        </div>
        <div className="px-4 py-3">
          <p className="mb-1.5 font-['Barlow_Condensed',sans-serif] text-[13px] font-extrabold text-[#0d1f3c]">
            Cabin Baggage
          </p>
          {/* cabin bag icon */}
          <div className="mb-2 flex items-end gap-2">
            <svg viewBox="0 0 48 36" className="h-9 w-11 fill-[#0d1f3c]" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="8" width="44" height="24" rx="4"/>
              <path d="M16 8 C16 4 20 2 24 2 C28 2 32 4 32 8" fill="none" stroke="#0d1f3c" strokeWidth="2.5"/>
              <line x1="2" y1="20" x2="46" y2="20" stroke="white" strokeWidth="1.5"/>
              <rect x="18" y="29" width="4" height="5" rx="2" fill="#8891a4"/>
              <rect x="26" y="29" width="4" height="5" rx="2" fill="#8891a4"/>
            </svg>
            <svg viewBox="0 0 36 44" className="h-10 w-8 fill-[#0d1f3c] opacity-60" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="28" height="36" rx="3"/>
              <rect x="10" y="1" width="16" height="6" rx="2" fill="none" stroke="#0d1f3c" strokeWidth="2"/>
              <line x1="4" y1="22" x2="32" y2="22" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="4" x2="18" y2="40" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-[11px] text-[#444]">
            Up to {carryOnKg} kg · {carryOnPieces} bag{carryOnPieces === 1 ? "" : "s"}
          </p>
          <p className="text-[10px] text-[#888]">55 × 40 × 30 cm &nbsp;/&nbsp; 22 × 15 × 12 in</p>
        </div>
      </div>

      {/* ── DON'T MISS YOUR FLIGHT ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        <p className="min-w-[110px] font-['Barlow_Condensed',sans-serif] text-[18px] font-extrabold leading-tight text-[#0d1f3c]">
          Don&apos;t miss<br />your flight!
        </p>
        <div className="flex flex-1 gap-3">
          {countdowns.map(({ num, unit, desc }) => (
            <div key={num} className="flex flex-1 flex-col items-center text-center">
              {/* ring with arrow */}
              <div className="relative mb-1.5 flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full border-[3px] border-[#0d1f3c]">
                {/* gold arrow */}
                <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 border-b-[8px] border-b-[#c9a227] border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent" />
                <span className="font-['Barlow_Condensed',sans-serif] text-[22px] font-extrabold leading-none text-[#0d1f3c]">
                  {num}
                </span>
                <span className="text-[8px] font-semibold uppercase tracking-wide text-[#666]">
                  {unit}
                </span>
              </div>
              <p className="text-[8px] leading-snug text-[#555]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {ticket.ticket_terms.terms_html && (
        <div className="border-t border-[#e2e6ee] px-5 py-3 text-xs text-[#777]">
          {ticket.ticket_terms.title && (
            <p className="mb-1 font-semibold text-[#0d1f3c]">{ticket.ticket_terms.title}</p>
          )}
          <p className="whitespace-pre-wrap">{ticket.ticket_terms.terms_html}</p>
        </div>
      )}

      {/* ── DIAGONAL STRIPE FOOTER ── */}
      <div className="h-3.5 bg-[repeating-linear-gradient(135deg,#0d1f3c_0,#0d1f3c_12px,#c9a227_12px,#c9a227_24px)]" />
    </div>
  );
}
