"use client";

import { useMemo, useState } from "react";
import { Loader2, Luggage } from "lucide-react";
import { addBaggage, estimateExcessFee, type BaggagePolicy, type BaggageRecord } from "@/services/baggage";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { BaggagePrintButton } from "@/components/portal/baggage-print-button";

interface Traveler {
  name: string;
}

interface BookingBaggagePanelProps {
  /** Reservation ref (RES-…) or confirmed PNR — not only the PNR field. */
  bookingRef: string;
  travelers: Traveler[];
  baggage: BaggageRecord[];
  policy?: BaggagePolicy;
  baggageFeesTotal?: number;
  onUpdated: () => void | Promise<void>;
  /** Show per-traveler weight inputs (check-in flow). */
  showCheckInWeights?: boolean;
  checkInWeights?: Record<number, string>;
  onCheckInWeightChange?: (index: number, value: string) => void;
}

export function BookingBaggagePanel({
  bookingRef,
  travelers,
  baggage,
  policy,
  baggageFeesTotal,
  onUpdated,
  showCheckInWeights,
  checkInWeights,
  onCheckInWeightChange,
}: BookingBaggagePanelProps) {
  const { formatMoney } = useCurrency();
  const [addWeights, setAddWeights] = useState<Record<number, string>>({});
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  const allowanceLabel = policy
    ? `Included allowance: ${policy.max_baggage_kg} kg per bag · excess ${formatMoney(policy.excess_baggage_fee_per_kg)}/kg`
    : "Configure allowance in BA Settings (Desk).";

  const tagsByTraveler = useMemo(() => {
    const map = new Map<string, BaggageRecord[]>();
    for (const tag of baggage) {
      const key = tag.passenger_name || "";
      const list = map.get(key) || [];
      list.push(tag);
      map.set(key, list);
    }
    return map;
  }, [baggage]);

  const handleAddBaggage = async (index: number) => {
    const raw = addWeights[index]?.trim();
    const weight = raw ? parseFloat(raw) : 0;
    if (!weight || weight <= 0) {
      toast.error("Enter baggage weight in kg");
      return;
    }
    setAddingIndex(index);
    try {
      const res = await addBaggage(bookingRef, weight, index);
      toast.success(
        `Baggage tag ${res.tracking_number}${res.fee > 0 ? ` · excess ${formatMoney(res.fee)}` : ""}`,
      );
      setAddWeights((prev) => ({ ...prev, [index]: "" }));
      await onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not register baggage");
    } finally {
      setAddingIndex(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden space-y-0">
      <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/30">
        <Luggage className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">Baggage tags</p>
          <p className="text-xs text-muted-foreground">
            {allowanceLabel} Tracking numbers are created automatically (e.g. 001-BA-00001).
          </p>
        </div>
        {baggageFeesTotal != null && baggageFeesTotal > 0 && (
          <p className="ml-auto text-sm font-medium">
            Excess on booking: {formatMoney(baggageFeesTotal)}
          </p>
        )}
      </div>

      {baggage.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Print tag</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baggage.map((b) => (
              <TableRow key={b.tracking_number}>
                <TableCell className="font-mono text-sm">{b.tracking_number}</TableCell>
                <TableCell>{b.passenger_name}</TableCell>
                <TableCell>{b.weight_kg} kg</TableCell>
                <TableCell>
                  {b.baggage_fee > 0 ? formatMoney(b.baggage_fee) : "—"}
                  {b.is_excess ? (
                    <span className="ml-1 text-xs text-amber-700">excess</span>
                  ) : null}
                </TableCell>
                <TableCell>{b.status}</TableCell>
                <TableCell className="text-right">
                  <BaggagePrintButton
                    trackingNumber={b.tracking_number}
                    passengerName={b.passenger_name}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">No baggage registered for this booking yet.</p>
      )}

      <div className="border-t px-4 py-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Create baggage tag
        </p>
        <p className="text-xs text-muted-foreground -mt-2">
          Enter weight and click Create tag — the system assigns the next tracking number for this
          PNR.
        </p>
        {travelers.map((t, index) => {
          const weightStr = addWeights[index] ?? "";
          const weight = weightStr ? parseFloat(weightStr) : 0;
          const preview =
            policy && weight > 0 ? estimateExcessFee(weight, policy) : { isExcess: false, fee: 0 };
          const existing = tagsByTraveler.get(t.name) || [];

          return (
            <div
              key={`${t.name}-${index}`}
              className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3 border-b border-dashed pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.name}</p>
                {existing.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tags: {existing.map((x) => x.tracking_number).join(", ")}
                  </p>
                )}
                {showCheckInWeights && onCheckInWeightChange && (
                  <div className="mt-2 flex items-center gap-2 max-w-xs">
                    <label className="text-xs text-muted-foreground shrink-0">
                      At check-in (kg)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="Optional"
                      className="h-8"
                      value={checkInWeights?.[index] ?? ""}
                      onChange={(e) => onCheckInWeightChange(index, e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Weight (kg)</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    className="h-9 w-28 mt-0.5"
                    value={weightStr}
                    onChange={(e) =>
                      setAddWeights((prev) => ({ ...prev, [index]: e.target.value }))
                    }
                  />
                  {preview.isExcess && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      Est. excess {formatMoney(preview.fee)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={addingIndex !== null}
                  onClick={() => handleAddBaggage(index)}
                >
                  {addingIndex === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create tag"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
