"use client";

import { Plane } from "lucide-react";
import { PrintBarcodeStrip } from "@/components/portal/print-barcode-strip";
import {
  formatTicketClock,
  formatTicketDate,
  type PassengerTicketData,
} from "@/lib/passenger-ticket";

export function PassengerTicketDocument({ ticket }: { ticket: PassengerTicketData }) {
  const checkedKg = ticket.baggage_policy.checked_kg ?? 23;
  const carryOnKg = ticket.baggage_policy.carry_on_kg ?? 7;

  return (
    <div className="passenger-ticket-sheet mx-auto w-full max-w-[820px] bg-white text-navy shadow-lg print:shadow-none">
      <div className="relative flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-16 w-28 items-center justify-center rounded-br-[2.5rem] bg-navy text-cream">
            <div className="text-center">
              <Plane className="mx-auto mb-1 h-5 w-5 text-gold" />
              <p className="text-[10px] font-bold tracking-wider">{ticket.airline_name}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-navy/50">E-Ticket</p>
            <p className="text-xs text-navy/60">{ticket.airline_tagline}</p>
          </div>
        </div>
        <PrintBarcodeStrip value={ticket.barcode_data} />
      </div>

      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <h2 className="text-2xl font-bold tracking-wide">{ticket.passenger_name}</h2>
        <div className="text-right text-sm">
          <p className="text-red-600">
            Seq No: <span className="font-semibold">{String(ticket.sequence_no).padStart(3, "0")}</span>
          </p>
          <p>
            Booking Ref: <span className="font-bold">{ticket.booking_ref}</span>
          </p>
        </div>
      </div>

      <div className="mx-6 mb-4 rounded bg-navy/5 px-4 py-2 text-sm font-semibold">
        Ticket {ticket.ticket_number}
      </div>

      <div className="grid grid-cols-4 gap-4 px-6 pb-4 text-sm">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Flight</p>
          <p className="flex items-center gap-1 font-bold">
            <Plane className="h-3.5 w-3.5 text-gold" />
            {ticket.flight_number}
          </p>
        </div>
        <div className="col-span-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">From</p>
          <p className="font-semibold leading-snug">{ticket.origin_label}</p>
        </div>
        <div className="col-span-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">To</p>
          <p className="font-semibold leading-snug">{ticket.destination_label}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Class</p>
          <p className="font-bold">{ticket.seat_class}</p>
        </div>
      </div>

      <div className="mx-6 border-t border-dashed border-navy/20" />

      <div className="grid grid-cols-3 gap-4 px-6 py-4 text-sm md:grid-cols-6">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Date</p>
          <p className="font-semibold">{formatTicketDate(ticket.departure_date)}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Seat</p>
          <p className="text-xl font-bold text-gold">{ticket.seat}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Gate</p>
          <p className="font-semibold">{ticket.gate}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Zone</p>
          <p className="font-semibold">{ticket.zone}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Departing</p>
          <p className="font-semibold">{formatTicketClock(ticket.departure_time)}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy/50">Boarding</p>
          <p className="font-semibold">{formatTicketClock(ticket.boarding_time)}</p>
        </div>
      </div>

      <p className="px-6 pb-4 text-xs text-navy/60">
        Gate closes {formatTicketClock(ticket.gate_close_time)}
      </p>

      <div className="bg-navy px-6 py-2 text-center text-xs text-cream">
        Baggage allowance — checked {checkedKg} kg · cabin {carryOnKg} kg per passenger
      </div>

      <div className="grid grid-cols-2 gap-6 px-6 py-5 text-sm">
        <div>
          <p className="mb-2 font-bold">Checked baggage</p>
          <p>{ticket.seat_class}: up to {checkedKg} kg</p>
          <p className="text-xs text-navy/60">95 x 75 x 45 cm / 38 x 30 x 18 in</p>
        </div>
        <div>
          <p className="mb-2 font-bold">Cabin baggage</p>
          <p>Up to {carryOnKg} kg · one bag</p>
          <p className="text-xs text-navy/60">55 x 40 x 30 cm / 22 x 15 x 12 in</p>
        </div>
      </div>

      {ticket.ticket_terms.terms_html ? (
        <div className="border-t border-navy/10 px-6 py-4 text-xs text-navy/70">
          {ticket.ticket_terms.title ? (
            <p className="mb-1 font-semibold text-navy">{ticket.ticket_terms.title}</p>
          ) : null}
          <p className="whitespace-pre-wrap">{ticket.ticket_terms.terms_html}</p>
        </div>
      ) : null}

      <div className="border-t border-navy/10 px-6 py-4">
        <p className="mb-3 text-sm font-semibold">Don&apos;t miss your flight!</p>
        <div className="grid grid-cols-2 gap-3 text-center text-xs md:grid-cols-4">
          {[
            ["3 hours", "Arrive at the airport before departure"],
            ["60 minutes", "Check-in counters close before departure"],
            ["40 minutes", "Boarding begins before departure"],
            ["15 minutes", "Boarding gates close before departure"],
          ].map(([time, label]) => (
            <div key={time} className="rounded-lg border border-navy/10 p-2">
              <p className="text-lg font-bold text-gold">{time}</p>
              <p className="text-navy/60">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="h-4 bg-[repeating-linear-gradient(135deg,#1a2744_0,#1a2744_12px,#c9a227_12px,#c9a227_24px)]" />
    </div>
  );
}
