"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  flightScheduleStatusStyle,
  paymentStatusStyle,
  reservationStatusStyle,
  type StatusStyle,
} from "@/lib/portal-status-styles";

type StatusKind = "reservation" | "payment" | "flight_schedule";

function styleFor(kind: StatusKind, status: string): StatusStyle {
  switch (kind) {
    case "payment":
      return paymentStatusStyle(status);
    case "flight_schedule":
      return flightScheduleStatusStyle(status);
    default:
      return reservationStatusStyle(status);
  }
}

export function StatusBadge({
  status,
  kind = "reservation",
  onFilter,
  className,
}: {
  status: string;
  kind?: StatusKind;
  /** When set, badge is clickable and applies this status to the list filter (Frappe-style). */
  onFilter?: (status: string) => void;
  className?: string;
}) {
  const style = styleFor(kind, status);
  const interactive = !!onFilter && !!status;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        style.className,
        interactive && "cursor-pointer transition-colors",
        className,
      )}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onFilter(status);
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onFilter(status);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={interactive ? `Filter by ${style.label}` : undefined}
    >
      {style.label}
    </Badge>
  );

  return badge;
}
