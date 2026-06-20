"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PortalSeatRow } from "@/services/seatInventoryPortal";

export const SEAT_STATUS_STYLES: Record<
  string,
  { label: string; className: string; legendClass: string }
> = {
  Available: {
    label: "Available",
    className: "border-emerald-500/60 bg-emerald-50 text-emerald-900 hover:border-emerald-600",
    legendClass: "bg-emerald-100 border-emerald-500",
  },
  Hold: {
    label: "On hold",
    className: "border-amber-500/70 bg-amber-50 text-amber-900 hover:border-amber-600",
    legendClass: "bg-amber-100 border-amber-500",
  },
  Reserved: {
    label: "On hold",
    className: "border-amber-500/70 bg-amber-50 text-amber-900 hover:border-amber-600",
    legendClass: "bg-amber-100 border-amber-500",
  },
  Booked: {
    label: "Booked",
    className: "border-navy/40 bg-navy/10 text-navy hover:border-navy/60",
    legendClass: "bg-navy/15 border-navy/40",
  },
  Occupied: {
    label: "Occupied",
    className: "border-red-400/70 bg-red-50 text-red-900 hover:border-red-500",
    legendClass: "bg-red-100 border-red-400",
  },
  Unreleased: {
    label: "Unreleased",
    className: "border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400",
    legendClass: "bg-slate-200 border-slate-400",
  },
};

export function seatStatusStyle(status: string) {
  return (
    SEAT_STATUS_STYLES[status] ?? {
      label: status,
      className: "border-muted bg-muted text-muted-foreground",
      legendClass: "bg-muted border-muted-foreground",
    }
  );
}

export function SeatMapLegend() {
  const items = ["Available", "Unreleased", "Hold", "Booked", "Occupied"];
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items.map((status) => {
        const style = seatStatusStyle(status);
        return (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded border", style.legendClass)} />
            <span className="text-muted-foreground">{style.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function planSeatSort(a: PortalSeatRow, b: PortalSeatRow) {
  const classCmp = (a.seat_class_name || a.seat_class).localeCompare(
    b.seat_class_name || b.seat_class,
  );
  if (classCmp !== 0) return classCmp;
  const numA = parseInt(a.seat_number.split("-").pop() || "0", 10);
  const numB = parseInt(b.seat_number.split("-").pop() || "0", 10);
  return numA - numB;
}

function planSeatNumber(seat: PortalSeatRow) {
  const suffix = seat.seat_number.split("-").pop();
  return suffix && /^\d+$/.test(suffix) ? suffix : seat.seat_number;
}

function planSeatClassLabel(seat: PortalSeatRow) {
  return (seat.seat_class_name || seat.seat_class || "").trim();
}

function SeatGridCell({
  seat,
  selected,
  onSeatClick,
}: {
  seat: PortalSeatRow;
  selected: boolean;
  onSeatClick?: (seat: PortalSeatRow) => void;
}) {
  const style = seatStatusStyle(seat.status);
  const classLabel = planSeatClassLabel(seat);
  return (
    <button
      type="button"
      title={`${classLabel ? `${classLabel} · ` : ""}${seat.seat_number} · ${style.label}${
        seat.booking_reference ? ` · ${seat.booking_reference}` : ""
      }`}
      onClick={() => onSeatClick?.(seat)}
      className={cn(
        "flex h-12 w-full min-w-14 flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 leading-tight transition-colors",
        style.className,
        selected && "ring-2 ring-gold ring-offset-1",
        onSeatClick && "cursor-pointer",
      )}
    >
      <span className="text-xs font-semibold">{planSeatNumber(seat)}</span>
      {classLabel ? (
        <span className="max-w-full truncate text-[10px] font-normal text-inherit/90">
          {classLabel}
        </span>
      ) : null}
    </button>
  );
}

export function SeatMapGrid({
  seats,
  selectedSeatId,
  onSeatClick,
  className,
  columns,
  usesPlanQuotas = false,
}: {
  seats: PortalSeatRow[];
  selectedSeatId?: string | null;
  onSeatClick?: (seat: PortalSeatRow) => void;
  className?: string;
  /** Fixed column count (e.g. 10 for recurring-plan quota seats). Omit for airplane row layout. */
  columns?: number;
  usesPlanQuotas?: boolean;
}) {
  const gridSeats = useMemo(() => {
    if (!columns) return null;
    return [...seats].sort(planSeatSort);
  }, [seats, columns]);

  const seatsByRow = useMemo(() => {
    if (columns) return {};
    const grouped: Record<number, PortalSeatRow[]> = {};
    for (const seat of seats) {
      const row = parseInt(seat.seat_number, 10) || 0;
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
    }
    return grouped;
  }, [seats, columns]);

  if (seats.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {usesPlanQuotas
          ? "No seats in inventory for this flight. Set class quotas on the recurring plan and refresh."
          : "No seats in inventory for this flight. Generate seats from the airplane layout."}
      </p>
    );
  }

  if (columns && gridSeats) {
    return (
      <div
        className={cn("grid gap-1.5", className)}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(3.5rem, 1fr))` }}
      >
        {gridSeats.map((seat) => (
          <SeatGridCell
            key={seat.name}
            seat={seat}
            selected={selectedSeatId === seat.name}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5 overflow-x-auto", className)}>
      {Object.keys(seatsByRow)
        .map(Number)
        .sort((a, b) => a - b)
        .map((row) => (
          <div key={row} className="flex min-w-max items-center justify-center gap-1">
            <span className="w-8 shrink-0 text-center text-xs text-muted-foreground">{row}</span>
            {seatsByRow[row]
              .sort((a, b) => a.seat_number.localeCompare(b.seat_number))
              .map((seat) => {
                const style = seatStatusStyle(seat.status);
                const selected = selectedSeatId === seat.name;
                return (
                  <button
                    key={seat.name}
                    type="button"
                    title={`${seat.seat_number} · ${style.label}${
                      seat.booking_reference ? ` · ${seat.booking_reference}` : ""
                    }`}
                    onClick={() => onSeatClick?.(seat)}
                    className={cn(
                      "h-8 w-8 shrink-0 rounded border text-xs font-medium transition-colors",
                      style.className,
                      selected && "ring-2 ring-gold ring-offset-1",
                      onSeatClick && "cursor-pointer",
                    )}
                  >
                    {seat.seat_number.replace(/^\d+/, "") || seat.seat_number}
                  </button>
                );
              })}
          </div>
        ))}
    </div>
  );
}
