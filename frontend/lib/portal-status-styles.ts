export type ReservationStatus = "Booked" | "Confirm" | "Void" | "Flight Taken" | string;
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | string;
export type FlightScheduleStatus =
  | "Scheduled"
  | "Delayed"
  | "Cancelled"
  | "Departed"
  | "Arrived"
  | string;

export interface StatusStyle {
  label: string;
  className: string;
}

const RESERVATION_STYLES: Record<string, StatusStyle> = {
  Confirm: {
    label: "Confirm",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
  Booked: {
    label: "Booked",
    className: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  Void: {
    label: "Void",
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  },
  "Flight Taken": {
    label: "Flight Taken",
    className: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
  },
};

const PAYMENT_STYLES: Record<string, StatusStyle> = {
  Paid: {
    label: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
  Pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  Refunded: {
    label: "Refunded",
    className: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
  },
};

const FLIGHT_SCHEDULE_STYLES: Record<string, StatusStyle> = {
  Scheduled: {
    label: "Scheduled",
    className: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  },
  Delayed: {
    label: "Delayed",
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  Cancelled: {
    label: "Cancelled",
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  },
  Departed: {
    label: "Departed",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
  },
  Arrived: {
    label: "Arrived",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
};

const DEFAULT_STYLE: StatusStyle = {
  label: "",
  className: "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
};

function resolveStyle(map: Record<string, StatusStyle>, status: string): StatusStyle {
  const hit = map[status];
  if (hit) return hit;
  return { ...DEFAULT_STYLE, label: status || "—" };
}

export function reservationStatusStyle(status: string): StatusStyle {
  return resolveStyle(RESERVATION_STYLES, status);
}

export function paymentStatusStyle(status: string): StatusStyle {
  return resolveStyle(PAYMENT_STYLES, status);
}

export function flightScheduleStatusStyle(status: string): StatusStyle {
  return resolveStyle(FLIGHT_SCHEDULE_STYLES, status);
}
