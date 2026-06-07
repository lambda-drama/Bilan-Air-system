"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { normalizeBookingLookup } from "@/lib/booking-reference";
import { searchBookingsForCheckin, type CheckInBookingSuggestion } from "@/services/portal";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function bookingSuggestionToOption(s: CheckInBookingSuggestion) {
  const ref = s.reservation_ref || s.public_reference || s.pnr || "";
  const departure = s.departure_date
    ? `${s.departure_date}${s.departure_time ? ` ${s.departure_time}` : ""}`
    : "";
  const pnrSuffix = s.pnr && s.pnr !== ref ? ` · PNR ${s.pnr}` : "";
  return {
    value: ref,
    label: `${s.payer_name} · ${ref}${pnrSuffix}`,
    description: [
      s.flight_number || s.flight_schedule,
      departure,
      s.payment_status,
      s.payer_phone,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export interface BookingPnrSearchProps {
  pnr: string;
  onPnrChange: (pnr: string) => void;
  onLookup: (pnr: string) => void | Promise<void>;
  onClear?: () => void;
  loading?: boolean;
  loadLabel?: string;
  placeholder?: string;
  iconOnlyLoadOnMobile?: boolean;
}

export function BookingPnrSearch({
  pnr,
  onPnrChange,
  onLookup,
  onClear,
  loading = false,
  loadLabel = "Load",
  placeholder = "Search reservation ref, PNR, payer, phone...",
  iconOnlyLoadOnMobile = false,
}: BookingPnrSearchProps) {
  const [searchText, setSearchText] = useState("");
  const [suggestOptions, setSuggestOptions] = useState<
    ReturnType<typeof bookingSuggestionToOption>[]
  >([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const loadSuggestions = useCallback(async (query: string) => {
    setSuggestLoading(true);
    try {
      const rows = await searchBookingsForCheckin(query);
      setSuggestOptions(rows.map(bookingSuggestionToOption));
    } catch {
      setSuggestOptions([]);
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions("");
  }, [loadSuggestions]);

  useEffect(() => {
    const timer = setTimeout(() => loadSuggestions(searchText), 280);
    return () => clearTimeout(timer);
  }, [searchText, loadSuggestions]);

  const handleSelect = (selectedPnr: string) => {
    onPnrChange(selectedPnr);
    if (selectedPnr) {
      onLookup(selectedPnr);
    } else {
      onClear?.();
    }
  };

  const lookupCode = () => normalizeBookingLookup(searchText || pnr);

  const handleDirectLookup = (raw: string) => {
    const code = normalizeBookingLookup(raw);
    if (!code) return;
    onPnrChange(code);
    void onLookup(code);
  };

  return (
    <div
      className={cn(
        "flex gap-2",
        iconOnlyLoadOnMobile
          ? "flex-row items-start"
          : "flex-col sm:flex-row sm:items-start",
      )}
    >
      <div className="min-w-0 flex-1">
        <SearchableSelect
          options={suggestOptions}
          value={pnr}
          onValueChange={handleSelect}
          onSearchChange={setSearchText}
          onSubmitRaw={handleDirectLookup}
          isLoading={suggestLoading}
          placeholder={placeholder}
          emptyMessage={
            searchText.trim()
              ? "No bookings match your search"
              : "Type to search or pick a recent booking below"
          }
          clearable
        />
      </div>
      <Button
        type="button"
        size={iconOnlyLoadOnMobile ? "icon" : "default"}
        className={
          iconOnlyLoadOnMobile
            ? "bg-gold text-navy hover:bg-gold-dark shrink-0 sm:h-9 sm:w-auto sm:px-4"
            : "bg-gold text-navy hover:bg-gold-dark shrink-0"
        }
        aria-label={loadLabel}
        onClick={() => handleDirectLookup(lookupCode())}
        disabled={loading || !lookupCode()}
      >
        {loading ? (
          <Loader2 className={iconOnlyLoadOnMobile ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
        ) : (
          <Search className={iconOnlyLoadOnMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        )}
        {iconOnlyLoadOnMobile ? (
          <span className="hidden sm:inline">{loadLabel}</span>
        ) : (
          loadLabel
        )}
      </Button>
    </div>
  );
}
