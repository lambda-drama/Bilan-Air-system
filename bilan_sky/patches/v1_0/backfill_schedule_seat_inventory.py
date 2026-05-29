# Copyright (c) 2026, NF and contributors

import frappe


def execute():
	"""Backfill incomplete Seat Inventory for existing flight schedules."""
	for name in frappe.get_all("Flight Schedule", pluck="name"):
		doc = frappe.get_doc("Flight Schedule", name)
		try:
			doc.generate_seat_inventory(raise_on_error=False)
		except Exception:
			frappe.log_error(title=f"Seat backfill failed for {name}")
	frappe.db.commit()
