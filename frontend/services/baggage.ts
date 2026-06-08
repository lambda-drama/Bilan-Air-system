import { apiRequest, methodUrl } from "./apiClient";
import type { BaggagePrintData } from "@/lib/baggage-print";

export interface BaggagePolicy {
  max_baggage_kg: number;
  checked_kg?: number;
  carry_on_kg?: number;
  checked_pieces?: number;
  carry_on_pieces?: number;
  excess_baggage_fee_per_kg: number;
  seat_class?: string;
}

export interface BaggageRecord {
  /** Baggage Tracking document name (same as tracking_number). */
  name?: string;
  tracking_number: string;
  passenger_name: string;
  passenger?: string;
  weight_kg: number;
  baggage_fee: number;
  is_excess: number | boolean;
  status: string;
}

export interface AddBaggageResult {
  tracking_number: string;
  weight_kg: number;
  fee: number;
  is_excess: boolean;
  passenger_name: string;
}

export interface BaggageTraceResult {
  tracking_number: string;
  status: string;
  passenger?: string;
  passenger_name?: string;
  flight: string;
  weight_kg: number;
}

export async function getBaggagePolicy(): Promise<BaggagePolicy> {
  return apiRequest(methodUrl("baggage_tracking", "get_baggage_policy"), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function addBaggage(
  pnr: string,
  weight_kg: number,
  passenger_index: number,
): Promise<AddBaggageResult> {
  return apiRequest(methodUrl("baggage_tracking", "add_baggage"), {
    method: "POST",
    body: JSON.stringify({ pnr, weight_kg, passenger_index }),
  });
}

export async function getBaggagePrintData(tracking_number: string): Promise<{
  tracking_number: string;
  baggage: BaggagePrintData;
}> {
  return apiRequest(methodUrl("baggage_tracking", "get_baggage_print_data"), {
    method: "POST",
    body: JSON.stringify({ tracking_number: tracking_number.trim() }),
  });
}

export async function traceBaggage(tracking_number: string): Promise<BaggageTraceResult> {
  return apiRequest(methodUrl("baggage_tracking", "trace_baggage"), {
    method: "POST",
    body: JSON.stringify({ tracking_number: tracking_number.trim() }),
  });
}

export function checkedAllowanceKg(policy?: BaggagePolicy): number {
  if (!policy) return 0;
  return policy.checked_kg ?? policy.max_baggage_kg ?? 0;
}

export function estimateExcessFee(
  weightKg: number,
  policy: BaggagePolicy,
): { isExcess: boolean; fee: number } {
  if (!weightKg || weightKg <= 0) return { isExcess: false, fee: 0 };
  const max = checkedAllowanceKg(policy);
  if (weightKg <= max) return { isExcess: false, fee: 0 };
  const fee = (weightKg - max) * (policy.excess_baggage_fee_per_kg ?? 0);
  return { isExcess: true, fee };
}
