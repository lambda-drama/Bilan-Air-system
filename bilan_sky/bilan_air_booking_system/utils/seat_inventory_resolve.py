"""Resolve Seat Inventory document from link name or display seat number."""

from __future__ import annotations

import frappe
from frappe.utils import cstr


def resolve_seat_inventory_ref(seat_ref: str, flight_schedule: str) -> str | None:
	"""Return Seat Inventory name for a schedule from doc id (SI-…) or label (e.g. 12A)."""
	seat_ref = cstr(seat_ref).strip()
	flight_schedule = cstr(flight_schedule).strip()
	if not seat_ref or not flight_schedule:
		return None

	if frappe.db.exists("Seat Inventory", seat_ref):
		row = frappe.db.get_value(
			"Seat Inventory",
			seat_ref,
			["name", "flight_schedule"],
			as_dict=True,
		)
		if row and row.flight_schedule == flight_schedule:
			return row.name
		return None

	return frappe.db.get_value(
		"Seat Inventory",
		{"flight_schedule": flight_schedule, "seat_number": seat_ref},
		"name",
	)
