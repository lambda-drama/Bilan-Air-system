import { apiRequest, methodUrl } from "./apiClient";

export interface PortalSeatRow {
  name: string;
  seat_number: string;
  seat_class: string;
  seat_class_name: string;
  status: string;
  booking_reference?: string | null;
  hold_expiry?: string | null;
}

export interface ScheduleSeatInventory {
  schedule: {
    name: string;
    flight_number: string;
    route: string;
    airplane: string;
    departure_date: string;
    departure_time: string;
    status: string;
    origin: string;
    destination: string;
    uses_plan_quotas?: boolean;
    schedule_plan?: string;
  };
  expected_seats: number;
  total_seats: number;
  missing_seats: number;
  missing_seat_numbers: string[];
  stats: Record<string, number>;
  seats_by_class: Record<string, PortalSeatRow[]>;
  seats: PortalSeatRow[];
}

export async function getScheduleSeatInventory(scheduleName: string) {
  return apiRequest<ScheduleSeatInventory>(
    methodUrl("portal", "get_schedule_seat_inventory"),
    {
      method: "POST",
      body: JSON.stringify({ schedule_name: scheduleName }),
    },
  );
}

export async function portalHoldSeat(seatName: string, bookingReference?: string) {
  return apiRequest<PortalSeatRow>(methodUrl("portal", "portal_hold_seat"), {
    method: "POST",
    body: JSON.stringify({
      seat_name: seatName,
      booking_reference: bookingReference || null,
    }),
  });
}

export async function portalReleaseSeat(seatName: string) {
  return apiRequest<PortalSeatRow>(methodUrl("portal", "portal_release_seat"), {
    method: "POST",
    body: JSON.stringify({ seat_name: seatName }),
  });
}

export async function portalReleaseSeatForSale(seatName: string) {
  return apiRequest<PortalSeatRow>(methodUrl("portal", "portal_release_seat_for_sale"), {
    method: "POST",
    body: JSON.stringify({ seat_name: seatName }),
  });
}

export async function portalRestrictSeat(seatName: string) {
  return apiRequest<PortalSeatRow>(methodUrl("portal", "portal_restrict_seat"), {
    method: "POST",
    body: JSON.stringify({ seat_name: seatName }),
  });
}

export async function portalApplyClassReserves(
  scheduleName: string,
  targets: Array<{ seat_class: string; reserved: number }>,
) {
  return apiRequest<{ classes: Array<{ seat_class: string; unreleased: number; total: number }> }>(
    methodUrl("portal", "portal_apply_class_reserves"),
    {
      method: "POST",
      body: JSON.stringify({ schedule_name: scheduleName, targets }),
    },
  );
}
