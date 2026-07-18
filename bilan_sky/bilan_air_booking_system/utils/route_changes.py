"""Helpers to change route on flight setup / schedules and update booking journeys."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint, getdate, today

from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
	default_journey_airports,
	resolve_journey_segment_range,
	sync_schedule_segments_from_route,
)
from bilan_sky.bilan_air_booking_system.utils.seat_booking import (
	release_seat_for_booking,
	reserve_seat_for_booking,
)


def _active_booking_count(schedule_name: str) -> int:
	return frappe.db.count(
		"Air Booking",
		{
			"flight_schedule": schedule_name,
			"reservation_status": ["!=", "Void"],
			"docstatus": ["<", 2],
		},
	)


def apply_route_to_schedule(schedule_name: str, route: str, *, force: bool = False) -> dict:
	"""Update a schedule's route and re-sync segments. Blocks when active bookings unless force."""
	if not schedule_name or not frappe.db.exists("Flight Schedule", schedule_name):
		frappe.throw(_("Flight schedule not found."))
	if not route or not frappe.db.exists("Flight Route", route):
		frappe.throw(_("Route not found."))

	active = _active_booking_count(schedule_name)
	if active and not force:
		frappe.throw(
			_(
				"Cannot change route on {0}: {1} active booking(s). Cancel or rebook those first."
			).format(schedule_name, active)
		)

	doc = frappe.get_doc("Flight Schedule", schedule_name)
	old_route = doc.route
	if old_route == route:
		return {"schedule": schedule_name, "route": route, "changed": False, "active_bookings": active}

	doc.route = route
	sync_schedule_segments_from_route(doc)

	if doc.docstatus == 1:
		frappe.db.set_value("Flight Schedule", schedule_name, "route", route, update_modified=True)
		frappe.db.delete("Flight Schedule Segment", {"parent": schedule_name})
		for row in doc.get("segments") or []:
			payload = {
				"doctype": "Flight Schedule Segment",
				"parent": schedule_name,
				"parenttype": "Flight Schedule",
				"parentfield": "segments",
				"segment_index": row.segment_index,
				"origin_airport": row.origin_airport,
				"destination_airport": row.destination_airport,
			}
			if hasattr(row, "duration") and row.duration:
				payload["duration"] = row.duration
			if hasattr(row, "arrival_date") and row.arrival_date:
				payload["arrival_date"] = row.arrival_date
			if hasattr(row, "arrival_time") and row.arrival_time:
				payload["arrival_time"] = row.arrival_time
			frappe.get_doc(payload).insert(ignore_permissions=True)
	else:
		doc.save(ignore_permissions=True)

	frappe.db.commit()
	return {
		"schedule": schedule_name,
		"route": route,
		"previous_route": old_route,
		"changed": True,
		"active_bookings": active,
	}


def cascade_flight_setup_route(flight_number: str, new_route: str, previous_route: str | None) -> dict:
	"""When Flight Setup route changes, update future schedules (no active bookings) and plans."""
	if not previous_route or previous_route == new_route:
		return {"updated_schedules": 0, "skipped_schedules": 0, "updated_plans": 0}

	today_date = getdate(today())
	schedules = frappe.get_all(
		"Flight Schedule",
		filters={
			"flight_number": flight_number,
			"docstatus": ["<", 2],
			"status": ["not in", ["Cancelled"]],
		},
		fields=["name", "route", "departure_date"],
	)

	updated = 0
	skipped = 0
	for row in schedules:
		if getdate(row.departure_date) < today_date:
			skipped += 1
			continue
		if row.route == new_route:
			continue
		if _active_booking_count(row.name):
			skipped += 1
			continue
		try:
			apply_route_to_schedule(row.name, new_route)
			updated += 1
		except Exception:
			frappe.log_error(frappe.get_traceback(), "cascade_flight_setup_route")
			skipped += 1

	plans_updated = 0
	if frappe.db.exists("DocType", "Flight Schedule Plan"):
		for plan_name in frappe.get_all(
			"Flight Schedule Plan",
			filters={"flight_number": flight_number, "route": ["!=", new_route]},
			pluck="name",
		):
			frappe.db.set_value("Flight Schedule Plan", plan_name, "route", new_route, update_modified=True)
			plans_updated += 1

	return {
		"updated_schedules": updated,
		"skipped_schedules": skipped,
		"updated_plans": plans_updated,
	}


def _booking_editable(booking) -> None:
	if booking.reservation_status == "Void":
		frappe.throw(_("Cannot change route on a voided booking."))
	if booking.reservation_status == "Flight Taken":
		frappe.throw(_("Cannot change route after the flight has been taken."))


def update_booking_journey(booking, boarding_airport: str, deboarding_airport: str) -> dict:
	"""Change boarding/deboarding on the same flight schedule; re-hold seats when needed."""
	_booking_editable(booking)
	boarding_airport = (boarding_airport or "").strip()
	deboarding_airport = (deboarding_airport or "").strip()
	if not boarding_airport or not deboarding_airport:
		frappe.throw(_("Boarding and deboarding airports are required."))
	if boarding_airport == deboarding_airport:
		frappe.throw(_("Boarding and deboarding cannot be the same airport."))

	# Validate journey exists on this schedule
	resolve_journey_segment_range(booking.flight_schedule, boarding_airport, deboarding_airport)

	old_board = booking.boarding_airport
	old_deboard = booking.deboarding_airport
	if old_board == boarding_airport and old_deboard == deboarding_airport:
		return {
			"reservation_ref": booking.name,
			"boarding_airport": boarding_airport,
			"deboarding_airport": deboarding_airport,
			"changed": False,
		}

	# Release and re-reserve seats for the new journey
	for pax in booking.passengers or []:
		if not pax.seat_number:
			continue
		release_seat_for_booking(pax.seat_number, booking.name)

	booking.boarding_airport = boarding_airport
	booking.deboarding_airport = deboarding_airport

	seat_errors = []
	for pax in booking.passengers or []:
		if not pax.seat_number:
			continue
		result = reserve_seat_for_booking(
			pax.seat_number,
			booking.name,
			flight_schedule=booking.flight_schedule,
			boarding_airport=boarding_airport,
			deboarding_airport=deboarding_airport,
		)
		if not result.get("success"):
			seat_errors.append(f"{pax.passenger_name}: {result.get('message')}")
			pax.seat_number = None

	booking.flags.ignore_validate = True
	booking.calculate_total_fare()
	if booking.docstatus == 1:
		booking._update_after_submit()
	else:
		booking.save(ignore_permissions=True)
	booking.flags.ignore_validate = False
	frappe.db.commit()

	return {
		"reservation_ref": booking.name,
		"pnr": booking.pnr,
		"boarding_airport": boarding_airport,
		"deboarding_airport": deboarding_airport,
		"total_fare": booking.total_fare,
		"changed": True,
		"seat_warnings": seat_errors,
	}


def change_booking_flight(
	booking,
	new_schedule: str,
	boarding_airport: str | None = None,
	deboarding_airport: str | None = None,
) -> dict:
	"""Move a booking to another flight schedule (same or different route). Clears seats."""
	_booking_editable(booking)
	new_schedule = (new_schedule or "").strip()
	if not new_schedule or not frappe.db.exists("Flight Schedule", new_schedule):
		frappe.throw(_("Flight schedule not found."))

	schedule = frappe.get_doc("Flight Schedule", new_schedule)
	if cint(schedule.docstatus) != 1:
		frappe.throw(_("Selected flight is not published."))
	if schedule.status in ("Cancelled",):
		frappe.throw(_("Selected flight is cancelled."))
	if not cint(schedule.is_active):
		frappe.throw(_("Selected flight is not active for booking."))

	defaults = default_journey_airports(new_schedule)
	board = (boarding_airport or "").strip() or defaults.get("boarding_airport")
	deboard = (deboarding_airport or "").strip() or defaults.get("deboarding_airport")
	if not board or not deboard:
		frappe.throw(_("Could not determine boarding/deboarding for the new flight."))
	resolve_journey_segment_range(new_schedule, board, deboard)

	# Release seats on the old flight
	for pax in booking.passengers or []:
		if pax.seat_number:
			release_seat_for_booking(pax.seat_number, booking.name)
			pax.seat_number = None

	booking.flight_schedule = new_schedule
	booking.boarding_airport = board
	booking.deboarding_airport = deboard

	booking.flags.ignore_validate = True
	booking.calculate_total_fare()
	if booking.docstatus == 1:
		booking._update_after_submit()
		# Child seat clears need explicit write
		for pax in booking.passengers or []:
			if pax.name:
				frappe.db.set_value(
					"Air Booking Passenger",
					pax.name,
					{"seat_number": None},
					update_modified=True,
				)
	else:
		booking.save(ignore_permissions=True)
	booking.flags.ignore_validate = False
	frappe.db.commit()

	return {
		"reservation_ref": booking.name,
		"pnr": booking.pnr,
		"flight_schedule": new_schedule,
		"boarding_airport": board,
		"deboarding_airport": deboard,
		"total_fare": booking.total_fare,
		"flight_number": schedule.flight_number,
		"route": schedule.route,
	}
