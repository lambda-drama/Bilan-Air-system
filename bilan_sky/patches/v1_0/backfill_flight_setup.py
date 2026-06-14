"""Create Flight Setup masters from existing flight numbers."""

import frappe


def execute():
	if not frappe.db.table_exists("tabFlight Setup"):
		return

	numbers = frappe.db.sql(
		"SELECT DISTINCT flight_number FROM `tabFlight Schedule` WHERE flight_number IS NOT NULL AND flight_number != ''",
		as_dict=True,
	)
	for row in numbers:
		fn = (row.flight_number or "").strip()
		if not fn or frappe.db.exists("Flight Setup", fn):
			continue
		latest = frappe.get_all(
			"Flight Schedule",
			filters={"flight_number": fn},
			fields=["route", "airplane"],
			order_by="modified desc",
			limit=1,
		)
		if not latest or not latest[0].route or not latest[0].airplane:
			continue
		frappe.get_doc(
			{
				"doctype": "Flight Setup",
				"flight_number": fn,
				"route": latest[0].route,
				"airplane": latest[0].airplane,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

	frappe.db.commit()
