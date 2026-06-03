# Copyright (c) 2026, NF and contributors

import frappe

from bilan_sky.bilan_air_booking_system.utils.flight_numbering import schedule_document_name


def execute():
	"""Rename Flight Schedule IDs from KQ103 → KQ103-2026-06-15 so dates can share flight numbers."""
	for row in frappe.get_all(
		"Flight Schedule",
		fields=["name", "flight_number", "departure_date"],
	):
		if not row.flight_number or not row.departure_date:
			continue
		expected = schedule_document_name(row.flight_number, row.departure_date)
		if row.name == expected:
			continue
		if frappe.db.exists("Flight Schedule", expected):
			frappe.log_error(
				title=f"Flight schedule rename skipped: {row.name}",
				message=f"Target name {expected} already exists.",
			)
			continue
		frappe.rename_doc("Flight Schedule", row.name, expected, force=True)

	frappe.db.commit()
