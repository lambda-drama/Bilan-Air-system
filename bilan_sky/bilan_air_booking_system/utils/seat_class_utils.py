"""Cabin class and seat (fare) class resolution helpers."""

from __future__ import annotations

import frappe
from frappe.utils import cint, flt


def resolve_seat_class_ref(value: str | None) -> str | None:
	"""Resolve a Seat Class document name from fare code or link name."""
	if not value:
		return None
	value = value.strip()
	if frappe.db.exists("Seat Class", value):
		return value
	return frappe.db.get_value("Seat Class", {"class_name": value}, "name")


def cabin_name_for_seat_class(seat_class_name: str | None) -> str | None:
	if not seat_class_name:
		return None
	cabin_link = frappe.db.get_value("Seat Class", seat_class_name, "cabin_class")
	if not cabin_link:
		return None
	return frappe.db.get_value("Cabin Class", cabin_link, "cabin_name")


def cabin_name_for_layout_seat(seat_inventory_seat_class: str | None) -> str | None:
	return cabin_name_for_seat_class(seat_inventory_seat_class)


def seat_class_row_fields() -> list[str]:
	return [
		"name",
		"class_name",
		"cabin_class",
		"cabin_name",
		"use_on_aircraft_layout",
		"price_multiplier",
		"color_code",
		"checked_baggage_kg",
		"checked_baggage_pieces",
		"carry_on_kg",
		"carry_on_pieces",
		"description",
	]


def _attach_cabin_names(rows: list[dict]) -> list[dict]:
	cabin_links = {row.get("cabin_class") for row in rows if row.get("cabin_class")}
	cabin_names: dict[str, str] = {}
	if cabin_links:
		for row in frappe.get_all(
			"Cabin Class",
			filters={"name": ["in", list(cabin_links)]},
			fields=["name", "cabin_name"],
			ignore_permissions=True,
		):
			cabin_names[row.name] = row.cabin_name
	for row in rows:
		row["cabin_name"] = cabin_names.get(row.get("cabin_class") or "")
	return rows


def list_active_seat_classes(*, layout_only: bool | None = None) -> list[dict]:
	filters: dict = {"is_active": 1}
	if layout_only is True:
		filters["use_on_aircraft_layout"] = 1
	elif layout_only is False:
		filters["use_on_aircraft_layout"] = 0

	rows = frappe.get_all(
		"Seat Class",
		filters=filters,
		fields=[
			"name",
			"class_name",
			"cabin_class",
			"use_on_aircraft_layout",
			"price_multiplier",
			"color_code",
			"checked_baggage_kg",
			"checked_baggage_pieces",
			"carry_on_kg",
			"carry_on_pieces",
			"description",
		],
		order_by="price_multiplier asc",
		ignore_permissions=True,
	)
	return _attach_cabin_names(rows)


def list_bookable_fare_classes() -> list[dict]:
	"""Fare classes shown in search/booking. Falls back to layout classes per cabin."""
	active = list_active_seat_classes()
	fare_classes = [row for row in active if not cint(row.get("use_on_aircraft_layout"))]
	if fare_classes:
		return fare_classes

	layout_by_cabin: dict[str, dict] = {}
	for row in active:
		if cint(row.get("use_on_aircraft_layout")):
			layout_by_cabin[row.get("cabin_class") or ""] = row
	return list(layout_by_cabin.values())


def list_pricing_fare_classes() -> list[dict]:
	"""Ticket fare classes for flight pricing (not aircraft layout / cabin map classes)."""
	rows = list_active_seat_classes(layout_only=False)
	return sorted(rows, key=lambda row: (row.get("class_name") or "").lower())


def list_public_cabin_classes() -> list[dict]:
	from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import get_default_baggage_policy

	defaults = get_default_baggage_policy()
	rows = frappe.get_all(
		"Cabin Class",
		filters={"is_active": 1},
		fields=[
			"name",
			"cabin_name",
			"display_order",
			"color_code",
			"description",
			"checked_baggage_kg",
			"checked_baggage_pieces",
			"carry_on_kg",
			"carry_on_pieces",
		],
		order_by="display_order asc, cabin_name asc",
		ignore_permissions=True,
	)
	result = []
	for row in rows:
		checked_kg = flt(row.checked_baggage_kg) or defaults["checked_kg"]
		carry_on_kg = flt(row.carry_on_kg) or defaults["carry_on_kg"]
		checked_pieces = cint(row.checked_baggage_pieces) or defaults["checked_pieces"]
		result.append(
			{
				"name": row.name,
				"cabin_name": row.cabin_name,
				"display_order": cint(row.display_order),
				"color_code": row.color_code,
				"description": row.description,
				"checked_baggage_kg": checked_kg,
				"checked_baggage_pieces": checked_pieces,
				"carry_on_kg": carry_on_kg,
			}
		)
	return result


def fare_multiplier_for_code(fare_class_code: str | None) -> float:
	seat_class_name = resolve_seat_class_ref(fare_class_code)
	if not seat_class_name:
		return 1.0
	return flt(frappe.db.get_value("Seat Class", seat_class_name, "price_multiplier")) or 1.0


def layout_seat_class_for_cabin(cabin_name: str | None) -> str | None:
	if not cabin_name:
		return None
	cabin_link = frappe.db.get_value("Cabin Class", {"cabin_name": cabin_name}, "name")
	if not cabin_link:
		return None
	return frappe.db.get_value(
		"Seat Class",
		{"cabin_class": cabin_link, "use_on_aircraft_layout": 1},
		"name",
	)


def multiplier_for_cabin_name(cabin_name: str | None) -> float:
	layout_name = layout_seat_class_for_cabin(cabin_name)
	if layout_name:
		return flt(frappe.db.get_value("Seat Class", layout_name, "price_multiplier")) or 1.0
	return 1.0


def resolve_booking_fare_and_cabin(fare_class_code: str | None) -> tuple[str | None, str | None]:
	"""Return (fare_class_doc_name, cabin_display_name) from a fare code or legacy cabin name."""
	if not fare_class_code:
		return None, None
	fare_class_code = fare_class_code.strip()
	seat_class_name = resolve_seat_class_ref(fare_class_code)
	if seat_class_name:
		return seat_class_name, cabin_name_for_seat_class(seat_class_name)
	if fare_class_code in {"Economy", "Business", "First Class"}:
		return None, fare_class_code
	return None, None
