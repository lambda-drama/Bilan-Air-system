import type { BookingDetails } from "@/services/airBooking";

export interface PassengerTicketData {
  airline_name: string;
  airline_tagline: string;
  passenger_name: string;
  sequence_no: number;
  booking_ref: string;
  ticket_number: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  origin_label: string;
  destination_label: string;
  seat_class: string;
  departure_date: string;
  departure_time: string;
  arrival_time: string;
  boarding_time: string;
  gate_close_time: string;
  seat: string;
  gate: string;
  zone: string;
  passenger_type: string;
  baggage_policy: {
    checked_kg?: number;
    carry_on_kg?: number;
    excess_fee_per_kg?: number;
  };
  ticket_terms: {
    title?: string;
    terms_html?: string;
  };
  barcode_data: string;
}

export function isPassengerTicketPrintable(
  detail: Pick<BookingDetails, "status" | "pnr">,
  passenger: { can_print_ticket?: boolean; ticket_number?: string },
): boolean {
  if (passenger.can_print_ticket != null) return passenger.can_print_ticket;
  return detail.status === "Confirm" && !!detail.pnr && !!passenger.ticket_number;
}

export function formatTicketClock(time: string) {
  if (!time) return "—";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

export function formatTicketDate(dateStr: string) {
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
