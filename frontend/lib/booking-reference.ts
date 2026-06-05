/** Fields returned by fetch_booking_details / check-in search. */
export interface BookingReferenceFields {
  reservation_ref?: string | null;
  pnr?: string | null;
  public_reference?: string | null;
}

/** Internal reservation ID for API calls (works before a customer PNR is issued). */
export function bookingReference(detail: BookingReferenceFields): string {
  return (
    (detail.reservation_ref || "").trim() ||
    (detail.public_reference || "").trim() ||
    (detail.pnr || "").trim()
  );
}
