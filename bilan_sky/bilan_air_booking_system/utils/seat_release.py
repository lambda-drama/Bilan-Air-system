"""Partial seat release: only a subset of aircraft seats are bookable initially."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint


def iter_layout_seat_slots(airplane) -> list[tuple[str, str]]:
	"""Ordered (seat_number, seat_class) slots from airplane layout."""
	from frappe.utils import cstr

	slots = []
	for config in airplane.seat_config or []:
		rows = cint(config.rows)
		columns = [c.strip() for c in cstr(config.columns_per_row).split(",") if c.strip()]
		start_row = cint(config.start_row_number) or 1
		if rows <= 0 or not columns:
			continue
		for row in range(start_row, start_row + rows):
			for col in columns:
				slots.append((f"{row}{col}", config.seat_class))
	return slots


def aircraft_capacity(airplane_name: str) -> int:
	if not airplane_name:
		return 0
	airplane = frappe.get_doc("Airplane", airplane_name)
	return len(iter_layout_seat_slots(airplane))


def effective_release_count(schedule) -> int:
	"""How many seats should be Available (released for sale)."""
	capacity = aircraft_capacity(schedule.airplane)
	released = cint(schedule.seats_released_count or 0)
	initial = cint(schedule.initial_seats_released or 0)
	if released > 0:
		target = released
	elif initial > 0:
		target = initial
	else:
		target = capacity
	return min(max(target, 0), capacity)


def apply_release_status_to_schedule(schedule, *, only_unreleased: bool = False) -> int:
	"""Set Available vs Unreleased on seats according to release count. Returns newly released."""
	if not schedule.airplane:
		return 0

	airplane = frappe.get_doc("Airplane", schedule.airplane)
	slots = iter_layout_seat_slots(airplane)
	release_count = effective_release_count(schedule)

	existing = {
		row.seat_number: row
		for row in frappe.get_all(
			"Seat Inventory",
			filters={"flight_schedule": schedule.name},
			fields=["name", "seat_number", "status"],
		)
	}

	newly_released = 0
	for index, (seat_number, seat_class) in enumerate(slots):
		should_release = index < release_count
		row = existing.get(seat_number)
		if not row:
			continue
		if only_unreleased and row.status != "Unreleased":
			continue
		if should_release and row.status == "Unreleased":
			frappe.db.set_value("Seat Inventory", row.name, "status", "Available", update_modified=False)
			newly_released += 1
		elif not should_release and row.status == "Available":
			# Only hide empty available seats
			if not frappe.db.exists(
				"Seat Segment Allocation",
				{"seat_inventory": row.name, "status": ["in", ["Hold", "Booked"]]},
			) and not frappe.db.get_value("Seat Inventory", row.name, "booking_reference"):
				frappe.db.set_value("Seat Inventory", row.name, "status", "Unreleased", update_modified=False)

	if not only_unreleased:
		frappe.db.set_value(
			"Flight Schedule",
			schedule.name,
			"seats_released_count",
			release_count,
			update_modified=False,
		)
		frappe.db.set_value(
			"Flight Schedule",
			schedule.name,
			"total_aircraft_capacity",
			len(slots),
			update_modified=False,
		)
	return newly_released


def release_additional_seats(schedule_name: str, count: int) -> dict:
	schedule = frappe.get_doc("Flight Schedule", schedule_name)
	capacity = aircraft_capacity(schedule.airplane)
	current = effective_release_count(schedule)
	add = cint(count)
	if add <= 0:
		frappe.throw(_("Enter how many additional seats to release."))
	new_total = min(current + add, capacity)
	if new_total == current:
		return {
			"released_now": 0,
			"seats_released_count": current,
			"total_aircraft_capacity": capacity,
			"message": _("All aircraft seats are already released for sale."),
		}

	schedule.seats_released_count = new_total
	schedule.save(ignore_permissions=True)
	released_now = apply_release_status_to_schedule(schedule, only_unreleased=True)
	frappe.db.commit()
	return {
		"released_now": released_now,
		"seats_released_count": new_total,
		"total_aircraft_capacity": capacity,
		"unreleased_remaining": capacity - new_total,
	}
