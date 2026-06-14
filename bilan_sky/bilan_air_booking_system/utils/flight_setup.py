"""Flight Setup master helpers."""

import frappe
from frappe import _
from frappe.utils import cint


def flight_setup_available() -> bool:
	"""DocType installed (avoid tablename checks — spaces break table_exists)."""
	return bool(frappe.db.exists("DocType", "Flight Setup"))


def ensure_flight_setup(
	flight_number: str,
	*,
	route: str | None = None,
	airplane: str | None = None,
	terms_and_conditions: str | None = None,
	is_active: int | bool = 1,
) -> str | None:
	"""Ensure a Flight Setup exists for link validation and the flight hierarchy."""
	if not flight_setup_available():
		return None

	flight_number = (flight_number or "").strip()
	if not flight_number:
		return None

	if frappe.db.exists("Flight Setup", flight_number):
		doc = frappe.get_doc("Flight Setup", flight_number)
		changed = False
		if route and not doc.route:
			doc.route = route
			changed = True
		if airplane and not doc.airplane:
			doc.airplane = airplane
			changed = True
		if changed:
			doc.save(ignore_permissions=True)
		return flight_number

	route = (route or "").strip()
	airplane = (airplane or "").strip()
	if not route or not airplane:
		frappe.throw(
			_(
				"Flight number {0} is not set up yet. Open Flight setup, edit this flight number, "
				"and save route and aircraft first — or ensure route and aircraft are filled on this plan."
			).format(flight_number),
			title=_("Flight Setup required"),
		)

	doc = frappe.new_doc("Flight Setup")
	doc.flight_number = flight_number
	doc.route = route
	doc.airplane = airplane
	doc.terms_and_conditions = terms_and_conditions or ""
	doc.is_active = cint(is_active)
	doc.insert(ignore_permissions=True)
	return flight_number
