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


def layout_seat_counts_by_class(airplane_name: str) -> dict[str, int]:
	"""Total layout slots per Seat Class link on an airplane."""
	if not airplane_name:
		return {}
	airplane = frappe.get_doc("Airplane", airplane_name)
	counts: dict[str, int] = {}
	for _seat_number, seat_class in iter_layout_seat_slots(airplane):
		counts[seat_class] = counts.get(seat_class, 0) + 1
	return counts


def _seat_has_active_booking(seat_inventory_name: str) -> bool:
	if frappe.db.get_value("Seat Inventory", seat_inventory_name, "booking_reference"):
		return True
	return bool(
		frappe.db.exists(
			"Seat Segment Allocation",
			{"seat_inventory": seat_inventory_name, "status": ["in", ["Hold", "Booked"]]},
		)
	)


def plan_seat_slots(plan) -> list[tuple[str, str]]:
	"""Synthetic seat inventory slots from recurring plan class quotas."""
	slots: list[tuple[str, str]] = []
	for row in plan.seat_classes or []:
		seat_class = getattr(row, "seat_class", None)
		qty = cint(getattr(row, "number_of_seats", 0))
		if not seat_class or qty <= 0:
			continue
		for index in range(1, qty + 1):
			slots.append((f"{seat_class}-{index}", seat_class))
	return slots


def schedule_uses_plan_quotas(schedule) -> bool:
	"""Plan-linked schedules with Use Airplane Seats off use recurring plan counts only."""
	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import uses_airplane_seats

	if uses_airplane_seats():
		return False
	plan_name = getattr(schedule, "schedule_plan", None)
	if isinstance(schedule, dict):
		plan_name = schedule.get("schedule_plan")
	return bool(plan_name)


def expected_seat_count_for_schedule(schedule) -> int:
	if schedule_uses_plan_quotas(schedule):
		plan_name = getattr(schedule, "schedule_plan", None)
		if not plan_name:
			return 0
		plan = frappe.get_doc("Flight Schedule Plan", plan_name)
		return len(plan_seat_slots(plan))
	airplane = getattr(schedule, "airplane", None)
	return aircraft_capacity(airplane)


def expected_seat_numbers_for_schedule(schedule) -> list[str]:
	if schedule_uses_plan_quotas(schedule):
		plan_name = getattr(schedule, "schedule_plan", None)
		if not plan_name:
			return []
		plan = frappe.get_doc("Flight Schedule Plan", plan_name)
		return [seat_number for seat_number, _seat_class in plan_seat_slots(plan)]

	if not getattr(schedule, "airplane", None):
		return []
	airplane = frappe.get_doc("Airplane", schedule.airplane)
	return [seat_number for seat_number, _seat_class in iter_layout_seat_slots(airplane)]


def sync_schedule_seat_inventory(schedule, *, raise_on_error: bool = False) -> int:
	"""Rebuild seat inventory to match plan quotas or airplane layout (per BA Settings)."""
	if schedule_uses_plan_quotas(schedule):
		plan = frappe.get_doc("Flight Schedule Plan", schedule.schedule_plan)
		return ensure_plan_quota_seat_inventory(schedule, plan)
	return schedule.generate_seat_inventory(raise_on_error=raise_on_error)


def ensure_plan_quota_seat_inventory(schedule, plan) -> int:
	"""Create/update seat inventory to match recurring plan quotas exactly (no airplane layout)."""
	target_slots = plan_seat_slots(plan)
	target_numbers = {seat_number for seat_number, _seat_class in target_slots}

	existing_rows = frappe.get_all(
		"Seat Inventory",
		filters={"flight_schedule": schedule.name},
		fields=["name", "seat_number", "seat_class", "status"],
	)
	existing_by_number = {row.seat_number: row for row in existing_rows}

	for seat_number, seat_class in target_slots:
		row = existing_by_number.get(seat_number)
		if row:
			updates = {}
			if row.seat_class != seat_class:
				updates["seat_class"] = seat_class
			if row.status == "Unreleased":
				updates["status"] = "Available"
			if updates:
				frappe.db.set_value("Seat Inventory", row.name, updates, update_modified=False)
			continue

		frappe.get_doc(
			{
				"doctype": "Seat Inventory",
				"flight_schedule": schedule.name,
				"seat_number": seat_number,
				"seat_class": seat_class,
				"status": "Available",
			}
		).insert(ignore_permissions=True)

	for seat_number, row in existing_by_number.items():
		if seat_number in target_numbers:
			continue
		if _seat_has_active_booking(row.name):
			continue
		frappe.delete_doc("Seat Inventory", row.name, ignore_permissions=True)

	available_count = frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule.name, "status": "Available"},
	)
	total_capacity = len(target_slots)
	frappe.db.set_value(
		"Flight Schedule",
		schedule.name,
		{
			"seats_released_count": available_count,
			"total_aircraft_capacity": total_capacity,
		},
		update_modified=False,
	)
	return total_capacity


def apply_plan_seat_class_release(schedule, plan) -> int:
	"""Release bookable seats per recurring plan class quotas."""
	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import uses_airplane_seats

	if not uses_airplane_seats():
		return ensure_plan_quota_seat_inventory(schedule, plan)

	quotas: dict[str, int] = {}
	for row in plan.seat_classes or []:
		qty = cint(getattr(row, "number_of_seats", 0))
		seat_class = getattr(row, "seat_class", None)
		if seat_class and qty > 0:
			quotas[seat_class] = qty

	airplane = frappe.get_doc("Airplane", schedule.airplane)
	slots = iter_layout_seat_slots(airplane)
	inventories = {
		row.seat_number: row
		for row in frappe.get_all(
			"Seat Inventory",
			filters={"flight_schedule": schedule.name},
			fields=["name", "seat_number", "seat_class", "status"],
		)
	}

	if not quotas:
		if plan.seat_classes:
			for seat_number, _seat_class in slots:
				inv = inventories.get(seat_number)
				if inv and inv.status == "Available" and not _seat_has_active_booking(inv.name):
					frappe.db.set_value("Seat Inventory", inv.name, "status", "Unreleased", update_modified=False)
			frappe.db.set_value(
				"Flight Schedule",
				schedule.name,
				{"seats_released_count": 0, "total_aircraft_capacity": len(slots)},
				update_modified=False,
			)
			return 0
		return apply_release_status_to_schedule(schedule, only_unreleased=False)

	released_by_class = {seat_class: 0 for seat_class in quotas}
	total_released = 0

	for seat_number, seat_class in slots:
		inv = inventories.get(seat_number)
		if not inv:
			continue
		quota = quotas.get(seat_class)
		if quota is not None and released_by_class[seat_class] < quota:
			if inv.status == "Unreleased":
				frappe.db.set_value("Seat Inventory", inv.name, "status", "Available", update_modified=False)
			released_by_class[seat_class] += 1
			total_released += 1
		elif inv.status == "Available" and not _seat_has_active_booking(inv.name):
			frappe.db.set_value("Seat Inventory", inv.name, "status", "Unreleased", update_modified=False)

	frappe.db.set_value(
		"Flight Schedule",
		schedule.name,
		{
			"seats_released_count": total_released,
			"total_aircraft_capacity": len(slots),
		},
		update_modified=False,
	)
	return total_released


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


def _seat_layout_index(schedule, seat_number: str) -> int | None:
	"""Zero-based position of seat_number in airplane layout order."""
	if not schedule.airplane:
		return None
	airplane = frappe.get_doc("Airplane", schedule.airplane)
	for index, (number, _seat_class) in enumerate(iter_layout_seat_slots(airplane)):
		if number == seat_number:
			return index
	return None


def release_single_seat_for_sale(seat_name: str) -> dict:
	"""Release one Unreleased seat for booking and bump schedule release count if needed."""
	seat = frappe.get_doc("Seat Inventory", seat_name)
	if seat.status != "Unreleased":
		frappe.throw(
			_("Seat {0} is {1}. Only unreleased seats can be released for sale here.").format(
				seat.seat_number, seat.status
			)
		)

	schedule = frappe.get_doc("Flight Schedule", seat.flight_schedule)
	seat_index = _seat_layout_index(schedule, seat.seat_number)
	capacity = aircraft_capacity(schedule.airplane)
	current = effective_release_count(schedule)
	new_count = current
	if seat_index is not None:
		new_count = max(current, seat_index + 1)
	new_count = min(new_count, capacity)

	seat.status = "Available"
	seat.save(ignore_permissions=True)

	if new_count != current:
		frappe.db.set_value(
			"Flight Schedule",
			schedule.name,
			"seats_released_count",
			new_count,
			update_modified=False,
		)

	frappe.db.commit()
	return {
		"seat": seat.name,
		"seats_released_count": new_count,
		"total_aircraft_capacity": capacity,
	}


def restrict_single_seat_from_sale(seat_name: str) -> dict:
	"""Move an empty Available seat back to Unreleased (staff restriction)."""
	seat = frappe.get_doc("Seat Inventory", seat_name)
	if seat.status != "Available":
		frappe.throw(
			_("Seat {0} is {1}. Only available seats with no booking can be restricted.").format(
				seat.seat_number, seat.status
			)
		)
	if seat.booking_reference:
		frappe.throw(_("Seat {0} is linked to a booking.").format(seat.seat_number))
	if frappe.db.exists(
		"Seat Segment Allocation",
		{"seat_inventory": seat.name, "status": ["in", ["Hold", "Booked"]]},
	):
		frappe.throw(_("Seat {0} has active segment allocations.").format(seat.seat_number))

	seat.status = "Unreleased"
	seat.hold_expiry = None
	seat.save(ignore_permissions=True)
	frappe.db.commit()
	return {"seat": seat.name}


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
