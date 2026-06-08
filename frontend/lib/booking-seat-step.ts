import { bookingFlowPath } from "@/lib/booking-flow-params";
import { seatsStepHref } from "@/components/website-booking-flow-header";

export function officeBookingAfterFlightPath(
  scheduleId: string,
  enableSeatSelection: boolean,
): string {
  if (enableSeatSelection) {
    return `/portal/booking/new/seats?schedule=${encodeURIComponent(scheduleId)}`;
  }
  return `/portal/booking/new/travelers?schedule=${encodeURIComponent(scheduleId)}`;
}

export function websiteBookingAfterFlightPath(
  searchParams: URLSearchParams,
  enableSeatSelection: boolean,
): string {
  if (enableSeatSelection) {
    return seatsStepHref(searchParams);
  }
  return bookingFlowPath("/booking/account", searchParams);
}
