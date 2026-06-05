"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchBookingsForCheckin, type CheckInBookingSuggestion } from "@/services/portal";
import { SearchableSelect } from "@/components/portal/searchable-select";
import { Button } from "@/components/ui/button";

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
}

export function BookingPnrSearch({
  pnr,
  onPnrChange,
  onLookup,
  onClear,
  loading = false,
  loadLabel = "Load",
  placeholder = "Search reservation ref, PNR, payer, phone...",
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

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <SearchableSelect
          options={suggestOptions}
          value={pnr}
          onValueChange={handleSelect}
          onSearchChange={setSearchText}
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
        className="bg-gold text-navy hover:bg-gold-dark shrink-0"
        onClick={() => onLookup(pnr)}
        disabled={loading || !pnr.trim()}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-2 h-4 w-4" />
        )}
        {loadLabel}
      </Button>
    </div>
  );
}
