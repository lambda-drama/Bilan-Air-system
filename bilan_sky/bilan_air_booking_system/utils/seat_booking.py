"""Reserve and release seats for direct and multi-segment journeys."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import add_to_date, now

from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
	resolve_journey_segment_range,
	schedule_is_multi_segment,
	seat_available_for_journey,
)


def reserve_seat_for_booking(
	seat_name: str,
	booking_name: str,
	*,
	flight_schedule: str,
	boarding_airport=None,
	deboarding_airport=None,
	hold_minutes: int = 15,
) -> dict:
	seat = frappe.get_doc("Seat Inventory", seat_name)
	if seat.flight_schedule != flight_schedule:
		return {"success": False, "message": _("Seat does not belong to this flight.")}

	if schedule_is_multi_segment(flight_schedule):
		if not boarding_airport or not deboarding_airport:
			frappe.throw(_("Boarding and deboarding airports are required for this flight."))
		from_idx, to_idx = resolve_journey_segment_range(
			flight_schedule, boarding_airport, deboarding_airport
		)
		if not seat_available_for_journey(seat_name, flight_schedule, from_idx, to_idx):
			return {
				"success": False,
				"message": _("Seat {0} is not available for this journey.").format(seat.seat_number),
			}
		existing = frappe.db.exists(
			"Seat Segment Allocation",
			{
				"seat_inventory": seat_name,
				"air_booking": booking_name,
				"status": ["in", ["Hold", "Booked"]],
			},
		)
		if existing:
			return {"success": True, "message": _("Seat already held for this booking.")}

		settings = frappe.get_single("BA Settings")
		hold_minutes = hold_minutes or int(settings.hold_duration or 15)
		frappe.get_doc(
			{
				"doctype": "Seat Segment Allocation",
				"flight_schedule": flight_schedule,
				"seat_inventory": seat_name,
				"air_booking": booking_name,
				"from_segment_index": from_idx,
				"to_segment_index": to_idx,
				"boarding_airport": boarding_airport,
				"deboarding_airport": deboarding_airport,
				"status": "Hold",
			}
		).insert(ignore_permissions=True)

		frappe.db.commit()
		return {"success": True, "message": _("Seat {0} reserved for selected journey.").format(seat.seat_number)}

	return seat.reserve(booking_name, hold_minutes=hold_minutes)


def confirm_seat_for_booking(seat_name: str, booking_name: str) -> dict:
	seat = frappe.get_doc("Seat Inventory", seat_name)
	schedule = seat.flight_schedule

	if schedule_is_multi_segment(schedule):
		updated = frappe.db.sql(
			"""
			update `tabSeat Segment Allocation`
			set status = 'Booked'
			where seat_inventory = %s and air_booking = %s and status = 'Hold'
			""",
			(seat_name, booking_name),
		)
		if not updated:
			return {"success": False, "message": _("No segment hold found for this seat.")}
		frappe.db.commit()
		return {"success": True, "message": _("Seat {0} confirmed.").format(seat.seat_number)}

	return seat.confirm(booking_name)


def release_seat_for_booking(seat_name: str, booking_name: str | None = None) -> dict:
	seat = frappe.get_doc("Seat Inventory", seat_name)
	schedule = seat.flight_schedule

	if schedule_is_multi_segment(schedule):
		filters = {"seat_inventory": seat_name, "status": ["in", ["Hold", "Booked"]]}
		if booking_name:
			filters["air_booking"] = booking_name
		for row in frappe.get_all("Seat Segment Allocation", filters=filters, pluck="name"):
			frappe.db.set_value("Seat Segment Allocation", row, "status", "Cancelled")

		remaining = frappe.db.count(
			"Seat Segment Allocation",
			{"seat_inventory": seat_name, "status": ["in", ["Hold", "Booked"]]},
		)
		frappe.db.commit()
		return {"success": True, "message": _("Seat {0} released.").format(seat.seat_number)}

	return seat.release(booking_name)
