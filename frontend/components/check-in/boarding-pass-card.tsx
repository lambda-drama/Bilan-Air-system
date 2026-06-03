"use client";

import { formatFlightRouteLabel } from "@/lib/format-airport";
import type { BoardingPass } from "@/services/checkIn";
import { formatClock } from "@/lib/content/check-in-page";

export function BoardingPassCard({ pass }: { pass: BoardingPass }) {
  return (
    <div className="bg-white rounded-2xl border border-navy/10 overflow-hidden print:break-inside-avoid">
      <div className="bg-navy p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-gold text-xs font-semibold tracking-[0.2em] mb-1">
              BOARDING PASS
            </p>
            <p className="text-cream text-xl font-bold">{pass.pnr}</p>
          </div>
          <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-navy font-bold text-lg">BA</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Passenger</p>
            <p className="text-navy font-semibold">{pass.passenger_name}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Flight</p>
            <p className="text-navy font-semibold">{pass.flight_number}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Route</p>
            <p className="text-navy font-semibold">
              {formatFlightRouteLabel(pass)}
            </p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Date</p>
            <p className="text-navy font-semibold">{pass.departure_date}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Seat</p>
            <p className="text-gold text-2xl font-bold">{pass.seat}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Gate</p>
            <p className="text-navy text-2xl font-bold">{pass.gate}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Departure</p>
            <p className="text-navy font-semibold">{formatClock(pass.departure_time)}</p>
          </div>
          <div>
            <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Boarding</p>
            <p className="text-navy font-semibold">{formatClock(pass.boarding_time)}</p>
          </div>
          {pass.ticket_number && (
            <div className="col-span-2">
              <p className="text-navy/60 text-xs uppercase tracking-wider mb-1">Ticket</p>
              <p className="text-navy font-mono text-sm">{pass.ticket_number}</p>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-navy/20 pt-6">
          <div className="h-16 bg-[repeating-linear-gradient(90deg,#1a2744,#1a2744_2px,transparent_2px,transparent_4px)] rounded" />
        </div>
      </div>
    </div>
  );
}
