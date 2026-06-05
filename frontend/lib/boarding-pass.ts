export interface BoardingPassData {
  airline_name: string;
  airline_tagline: string;
  passenger_name: string;
  passenger_type: string;
  sequence_no: number;
  booking_ref: string;
  reservation_ref: string;
  pnr: string;
  ticket_number?: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  origin_label: string;
  destination_label: string;
  departure_date: string;
  departure_time: string;
  arrival_time?: string;
  boarding_time: string;
  gate_close_time?: string;
  seat: string;
  gate: string;
  zone: string;
  seat_class: string;
  check_in_status?: string;
  barcode_data: string;
}

export function formatBoardingClock(time: string) {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

export function formatBoardingDate(dateStr: string) {
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

export function isBoardingPassPrintable(checkInStatus?: string) {
  return checkInStatus === "Checked In" || checkInStatus === "Boarded";
}
