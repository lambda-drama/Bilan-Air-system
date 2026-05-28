# Copyright (c) 2026, NF and contributors

import frappe


def execute():
	"""Create missing Seat Inventory for existing flight schedules."""
	for name in frappe.get_all("Flight Schedule", pluck="name"):
		if frappe.db.count("Seat Inventory", {"flight_schedule": name}):
			continue
		doc = frappe.get_doc("Flight Schedule", name)
		try:
			doc.generate_seat_inventory(raise_on_error=False)
		except Exception:
			frappe.log_error(title=f"Seat backfill failed for {name}")
	frappe.db.commit()
