export interface BaggagePrintData {
  airline_name: string;
  airline_tagline: string;
  agency_logo_url?: string | null;
  tracking_number: string;
  passenger_name: string;
  passenger_last_name: string;
  reservation_ref: string;
  pnr: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  origin_label: string;
  destination_label: string;
  departure_date: string | null;
  departure_time: string;
  weight_kg: number;
  baggage_fee: number;
  is_excess: boolean;
  allowance_kg: number;
  status: string;
  checked_in_at: string | null;
  sequence_no: number;
  total_bags: number;
  barcode_data: string;
}

export type BaggagePrintFormat = "tag" | "receipt";

export function formatBaggageDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatBaggageClock(time: string) {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}
