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


def plan_has_class_quotas(plan) -> bool:
	"""True when the plan defines per-class seat totals."""
	return any(
		cint(getattr(row, "number_of_seats", 0)) > 0 for row in (plan.seat_classes or [])
	)


def plan_class_capacity(plan) -> dict[str, dict[str, int]]:
	"""Per seat class: total seats, reserved (Unreleased initially), available for sale."""
	result: dict[str, dict[str, int]] = {}
	for row in plan.seat_classes or []:
		seat_class = getattr(row, "seat_class", None)
		total = cint(getattr(row, "number_of_seats", 0))
		if not seat_class or total <= 0:
			continue
		reserved = min(max(cint(getattr(row, "reserved_seats", 0) or 0), 0), total)
		result[seat_class] = {
			"total": total,
			"reserved": reserved,
			"available": total - reserved,
		}
	return result


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


def sync_schedule_seat_inventory(
	schedule, *, raise_on_error: bool = False, apply_release_rules: bool = True
) -> int:
	"""Rebuild seat inventory to match plan quotas or airplane layout (per BA Settings)."""
	if schedule_uses_plan_quotas(schedule):
		plan = frappe.get_doc("Flight Schedule Plan", schedule.schedule_plan)
		return ensure_plan_quota_seat_inventory(
			schedule, plan, apply_release_rules=apply_release_rules
		)
	return schedule.generate_seat_inventory(raise_on_error=raise_on_error)


def ensure_plan_quota_seat_inventory(
	schedule, plan, *, apply_release_rules: bool = True
) -> int:
	"""Create/update seat inventory to match recurring plan quotas exactly (no airplane layout)."""
	class_capacity = plan_class_capacity(plan)
	target_slots: list[tuple[str, str, str]] = []
	for seat_class, cfg in class_capacity.items():
		for index in range(1, cfg["total"] + 1):
			status = "Available" if index <= cfg["available"] else "Unreleased"
			target_slots.append((f"{seat_class}-{index}", seat_class, status))

	target_numbers = {seat_number for seat_number, _seat_class, _status in target_slots}

	existing_rows = frappe.get_all(
		"Seat Inventory",
		filters={"flight_schedule": schedule.name},
		fields=["name", "seat_number", "seat_class", "status"],
	)
	existing_by_number = {row.seat_number: row for row in existing_rows}

	for seat_number, seat_class, target_status in target_slots:
		row = existing_by_number.get(seat_number)
		if row:
			updates = {}
			if row.seat_class != seat_class:
				updates["seat_class"] = seat_class
			if (
				apply_release_rules
				and row.status in ("Available", "Unreleased")
				and not _seat_has_active_booking(row.name)
				and row.status != target_status
			):
				updates["status"] = target_status
			if updates:
				frappe.db.set_value("Seat Inventory", row.name, updates, update_modified=False)
			continue

		frappe.get_doc(
			{
				"doctype": "Seat Inventory",
				"flight_schedule": schedule.name,
				"seat_number": seat_number,
				"seat_class": seat_class,
				"status": target_status,
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
		return ensure_plan_quota_seat_inventory(schedule, plan, apply_release_rules=True)

	class_capacity = plan_class_capacity(plan)

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

	if not class_capacity:
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

	class_seen: dict[str, int] = {}

	for seat_number, seat_class in slots:
		inv = inventories.get(seat_number)
		if not inv:
			continue
		cfg = class_capacity.get(seat_class)
		if not cfg:
			if inv.status == "Available" and not _seat_has_active_booking(inv.name):
				frappe.db.set_value("Seat Inventory", inv.name, "status", "Unreleased", update_modified=False)
			continue

		class_seen[seat_class] = class_seen.get(seat_class, 0) + 1
		class_index = class_seen[seat_class]

		if class_index <= cfg["available"]:
			if inv.status == "Unreleased":
				frappe.db.set_value("Seat Inventory", inv.name, "status", "Available", update_modified=False)
		elif inv.status == "Available" and not _seat_has_active_booking(inv.name):
			frappe.db.set_value("Seat Inventory", inv.name, "status", "Unreleased", update_modified=False)

	total_released = frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule.name, "status": "Available"},
	)
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


def apply_plan_seats_to_schedule(schedule, plan) -> int:
	"""Push recurring plan class seat totals and reserve counts onto a schedule."""
	if schedule_uses_plan_quotas(schedule):
		return ensure_plan_quota_seat_inventory(schedule, plan, apply_release_rules=True)

	schedule.flags.skip_global_release_rules = plan_has_class_quotas(plan)
	seats = schedule.generate_seat_inventory(raise_on_error=False)

	if plan_has_class_quotas(plan):
		return apply_plan_seat_class_release(schedule, plan)
	if not plan.seat_classes:
		return apply_release_status_to_schedule(schedule, only_unreleased=False)
	return seats


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


def _resolve_seat_class_link(seat_class: str | None) -> str | None:
	if not seat_class:
		return None
	if frappe.db.exists("Seat Class", seat_class):
		return seat_class
	return frappe.db.get_value("Seat Class", {"class_name": seat_class}, "name")


def _refresh_schedule_release_count(schedule_name: str) -> int:
	available = frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule_name, "status": "Available"},
	)
	frappe.db.set_value(
		"Flight Schedule",
		schedule_name,
		"seats_released_count",
		available,
		update_modified=False,
	)
	return available


def bulk_restrict_seats_by_class(schedule_name: str, seat_class: str, count: int) -> dict:
	"""Reserve (Unreleased) up to `count` Available seats in a class."""
	count = cint(count)
	if count <= 0:
		frappe.throw(_("Enter how many seats to reserve."))

	class_link = _resolve_seat_class_link(seat_class)
	if not class_link:
		frappe.throw(_("Seat class not found."))

	seats = frappe.get_all(
		"Seat Inventory",
		filters={
			"flight_schedule": schedule_name,
			"seat_class": class_link,
			"status": "Available",
		},
		fields=["name", "seat_number", "booking_reference"],
		order_by="seat_number asc",
	)

	reserved = 0
	for seat in seats:
		if reserved >= count:
			break
		if seat.booking_reference or _seat_has_active_booking(seat.name):
			continue
		frappe.db.set_value(
			"Seat Inventory",
			seat.name,
			{"status": "Unreleased", "hold_expiry": None},
			update_modified=False,
		)
		reserved += 1

	if not reserved:
		frappe.throw(_("No available seats to reserve in this class."))

	seats_released_count = _refresh_schedule_release_count(schedule_name)
	frappe.db.commit()
	return {
		"reserved": reserved,
		"seats_released_count": seats_released_count,
		"seat_class": class_link,
	}


def bulk_release_seats_by_class(schedule_name: str, seat_class: str, count: int) -> dict:
	"""Release up to `count` Unreleased seats in a class for sale."""
	count = cint(count)
	if count <= 0:
		frappe.throw(_("Enter how many seats to release for sale."))

	class_link = _resolve_seat_class_link(seat_class)
	if not class_link:
		frappe.throw(_("Seat class not found."))

	seats = frappe.get_all(
		"Seat Inventory",
		filters={
			"flight_schedule": schedule_name,
			"seat_class": class_link,
			"status": "Unreleased",
		},
		fields=["name", "seat_number"],
		order_by="seat_number asc",
	)

	released = 0
	for seat in seats:
		if released >= count:
			break
		frappe.db.set_value("Seat Inventory", seat.name, "status", "Available", update_modified=False)
		released += 1

	if not released:
		frappe.throw(_("No unreleased seats to release in this class."))

	seats_released_count = _refresh_schedule_release_count(schedule_name)
	frappe.db.commit()
	return {
		"released": released,
		"seats_released_count": seats_released_count,
		"seat_class": class_link,
	}


def _class_reserve_snapshot(schedule_name: str, class_link: str) -> dict:
	rows = frappe.get_all(
		"Seat Inventory",
		filters={"flight_schedule": schedule_name, "seat_class": class_link},
		fields=["name", "status", "booking_reference"],
	)
	locked_statuses = {"Booked", "Occupied", "Hold", "Reserved"}
	total = len(rows)
	locked = 0
	unreleased = 0
	available = 0
	for row in rows:
		status = row.status
		if status in locked_statuses or row.booking_reference or _seat_has_active_booking(row.name):
			locked += 1
		elif status == "Unreleased":
			unreleased += 1
		elif status == "Available":
			available += 1
	return {
		"total": total,
		"locked": locked,
		"unreleased": unreleased,
		"available": available,
		"max_unreleased": max(total - locked, 0),
	}


def apply_class_reserve_target(
	schedule_name: str, seat_class: str, target_reserved: int, *, commit: bool = True
) -> dict:
	"""Set how many seats in a class are Unreleased (held from sale)."""
	class_link = _resolve_seat_class_link(seat_class)
	if not class_link:
		frappe.throw(_("Seat class not found."))

	snapshot = _class_reserve_snapshot(schedule_name, class_link)
	target_reserved = min(max(cint(target_reserved), 0), snapshot["max_unreleased"])
	delta = target_reserved - snapshot["unreleased"]

	if delta > 0:
		seats = frappe.get_all(
			"Seat Inventory",
			filters={
				"flight_schedule": schedule_name,
				"seat_class": class_link,
				"status": "Available",
			},
			fields=["name", "booking_reference"],
			order_by="seat_number asc",
		)
		moved = 0
		for seat in seats:
			if moved >= delta:
				break
			if seat.booking_reference or _seat_has_active_booking(seat.name):
				continue
			frappe.db.set_value(
				"Seat Inventory",
				seat.name,
				{"status": "Unreleased", "hold_expiry": None},
				update_modified=False,
			)
			moved += 1
	elif delta < 0:
		release_count = -delta
		seats = frappe.get_all(
			"Seat Inventory",
			filters={
				"flight_schedule": schedule_name,
				"seat_class": class_link,
				"status": "Unreleased",
			},
			fields=["name"],
			order_by="seat_number asc",
		)
		moved = 0
		for seat in seats:
			if moved >= release_count:
				break
			frappe.db.set_value("Seat Inventory", seat.name, "status", "Available", update_modified=False)
			moved += 1

	after = _class_reserve_snapshot(schedule_name, class_link)
	seats_released_count = _refresh_schedule_release_count(schedule_name)
	if commit:
		frappe.db.commit()
	return {
		"seat_class": class_link,
		"target_reserved": target_reserved,
		"unreleased": after["unreleased"],
		"available": after["available"],
		"total": after["total"],
		"seats_released_count": seats_released_count,
	}


def apply_class_reserve_targets(schedule_name: str, targets: list[dict]) -> dict:
	results = []
	for row in targets or []:
		seat_class = row.get("seat_class")
		if not seat_class:
			continue
		results.append(
			apply_class_reserve_target(
				schedule_name,
				seat_class,
				row.get("reserved", 0),
				commit=False,
			)
		)
	frappe.db.commit()
	return {"classes": results}
