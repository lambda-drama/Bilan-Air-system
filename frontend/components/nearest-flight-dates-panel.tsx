"use client";

import { Loader2 } from "lucide-react";
import type { NearestFlightDateSuggestion } from "@/services/search";
import { cn } from "@/lib/utils";

type NearestFlightDatesPanelProps = {
  title: string;
  loadingLabel: string;
  emptyLabel: string;
  useDateLabel: (date: string) => string;
  formatDaysOffset: (days: number) => string;
  formatFlightCount: (count: number) => string;
  /** e.g. (amount) => "From $240" — shown when min_fare is available */
  formatFromPrice?: (amount: number) => string;
  suggestions: NearestFlightDateSuggestion[];
  loading: boolean;
  checked: boolean;
  onSelect: (date: string) => void;
  variant?: "hero" | "portal";
  className?: string;
};

export function NearestFlightDatesPanel({
  title,
  loadingLabel,
  emptyLabel,
  useDateLabel,
  formatDaysOffset,
  formatFlightCount,
  formatFromPrice,
  suggestions,
  loading,
  checked,
  onSelect,
  variant = "portal",
  className,
}: NearestFlightDatesPanelProps) {
  const isHero = variant === "hero";

  if (!loading && !checked && suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        isHero
          ? "text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-3"
          : "rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3",
        className,
      )}
    >
      {loading ? (
        <p
          className={cn(
            "inline-flex items-center gap-2 text-sm",
            isHero ? "text-amber-800/70" : "text-muted-foreground",
          )}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {loadingLabel}
        </p>
      ) : null}

      {!loading && suggestions.length > 0 ? (
        <div className="space-y-2">
          <p className={cn("font-semibold text-sm", isHero ? "text-amber-900" : "text-foreground")}>
            {title}
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.date}
                type="button"
                onClick={() => onSelect(suggestion.date)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                  isHero
                    ? "border-amber-300/80 bg-white hover:border-gold hover:bg-gold/10"
                    : "border-amber-200 bg-background hover:border-gold hover:bg-gold/5",
                )}
              >
                <span className="font-semibold text-navy">{useDateLabel(suggestion.date)}</span>
                <span className="block text-xs text-navy/60 mt-0.5">
                  {formatDaysOffset(suggestion.days_from_anchor)}
                  {" · "}
                  {formatFlightCount(suggestion.flight_count)}
                  {suggestion.min_fare != null &&
                  suggestion.min_fare > 0 &&
                  formatFromPrice
                    ? ` · ${formatFromPrice(suggestion.min_fare)}`
                    : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && checked && suggestions.length === 0 ? (
        <p className={cn("text-sm", isHero ? "text-amber-800/70" : "text-muted-foreground")}>
          {emptyLabel}
        </p>
      ) : null}
    </div>
  );
}
