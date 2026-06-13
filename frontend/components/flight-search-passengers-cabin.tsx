"use client";

import { Minus, Plus } from "lucide-react";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { FormField } from "@/components/portal/form-dialog";
import {
  MAX_TRAVELERS_PER_BOOKING,
  normalizePassengerCounts,
  SEAT_CLASS_OPTIONS,
  totalPassengers,
  type PassengerSearchCounts,
  type SeatClassOption,
} from "@/lib/passenger-search-counts";
import { cn } from "@/lib/utils";

type Labels = {
  adults: string;
  children: string;
  infants: string;
  cabin: string;
  infantsHint: string;
  passengers: string;
};

type FlightSearchPassengersCabinProps = {
  counts: PassengerSearchCounts;
  onCountsChange: (counts: PassengerSearchCounts) => void;
  seatClass: SeatClassOption;
  onSeatClassChange: (seatClass: SeatClassOption) => void;
  cabinOptions?: { value: SeatClassOption; label: string }[];
  variant?: "hero" | "portal";
  labels: Labels;
  disabled?: boolean;
  className?: string;
};

function CounterRow({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  variant,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  variant: "hero" | "portal";
  disabled?: boolean;
}) {
  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        isHero ? "rounded-lg border border-navy/10 bg-white/70 px-3 py-2.5" : "py-1",
      )}
    >
      <div className="min-w-0">
        <p className={cn("font-medium", isHero ? "text-navy text-sm" : "text-sm")}>{label}</p>
        {hint ? (
          <p className={cn("text-xs", isHero ? "text-navy/50" : "text-muted-foreground")}>{hint}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
            isHero
              ? "border-navy/15 text-navy hover:bg-navy/5"
              : "border-input text-foreground hover:bg-muted",
          )}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className={cn("w-6 text-center font-semibold tabular-nums", isHero && "text-navy")}>
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
            isHero
              ? "border-navy/15 text-navy hover:bg-navy/5"
              : "border-input text-foreground hover:bg-muted",
          )}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function FlightSearchPassengersCabin({
  counts,
  onCountsChange,
  seatClass,
  onSeatClassChange,
  cabinOptions,
  variant = "portal",
  labels,
  disabled = false,
  className,
}: FlightSearchPassengersCabinProps) {
  const normalized = normalizePassengerCounts(counts);
  const total = totalPassengers(normalized);
  const isHero = variant === "hero";
  const cabins = cabinOptions ?? SEAT_CLASS_OPTIONS;

  const updateCounts = (patch: Partial<PassengerSearchCounts>) => {
    onCountsChange(normalizePassengerCounts({ ...normalized, ...patch }));
  };

  const maxAdditional = MAX_TRAVELERS_PER_BOOKING - normalized.adults;
  const maxChildren = Math.min(maxAdditional, MAX_TRAVELERS_PER_BOOKING - normalized.adults);
  const maxInfants = Math.min(
    normalized.adults,
    MAX_TRAVELERS_PER_BOOKING - normalized.adults - normalized.children,
  );

  const passengerBlock = (
    <div className={cn("space-y-2", isHero && "rounded-xl border border-navy/10 p-3 bg-white/50")}>
      {!isHero && (
        <p className="text-sm font-medium text-foreground">
          {labels.passengers}{" "}
          <span className="text-muted-foreground font-normal">({total})</span>
        </p>
      )}
      {isHero && (
        <p className="text-navy/60 text-xs font-semibold tracking-wider mb-2">{labels.passengers}</p>
      )}
      <CounterRow
        label={labels.adults}
        value={normalized.adults}
        min={1}
        max={MAX_TRAVELERS_PER_BOOKING - normalized.children - normalized.infants}
        onChange={(adults) => updateCounts({ adults })}
        variant={variant}
        disabled={disabled}
      />
      <CounterRow
        label={labels.children}
        value={normalized.children}
        min={0}
        max={maxChildren}
        onChange={(children) => updateCounts({ children })}
        variant={variant}
        disabled={disabled}
      />
      <CounterRow
        label={labels.infants}
        hint={labels.infantsHint}
        value={normalized.infants}
        min={0}
        max={maxInfants}
        onChange={(infants) => updateCounts({ infants })}
        variant={variant}
        disabled={disabled}
      />
    </div>
  );

  const cabinField = isHero ? (
    <div>
      <label className="text-navy/60 text-xs font-semibold tracking-wider">{labels.cabin}</label>
      <SearchableSelect
        options={cabins}
        value={seatClass}
        onValueChange={(v) => onSeatClassChange(v as SeatClassOption)}
        clearable={false}
        disabled={disabled}
        inputClassName="bilan-light-field h-auto min-h-[2.75rem] py-2.5 text-base shadow-none mt-1"
      />
    </div>
  ) : (
    <FormField label={labels.cabin} required fullWidth>
      <SearchableSelect
        options={cabins}
        value={seatClass}
        onValueChange={(v) => onSeatClassChange(v as SeatClassOption)}
        clearable={false}
        disabled={disabled}
      />
    </FormField>
  );

  return (
    <div className={cn(isHero ? "space-y-4" : "grid gap-4 sm:grid-cols-2", className)}>
      <div className={cn(!isHero && "sm:col-span-2")}>{passengerBlock}</div>
      {cabinField}
    </div>
  );
}
