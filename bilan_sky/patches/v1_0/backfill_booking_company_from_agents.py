"""Create Booking Company records from legacy agent_name and link agents."""

import frappe

from bilan_sky.bilan_air_booking_system.utils.booking_company import create_booking_company


def execute():
	if not frappe.db.table_exists("tabBooking Company"):
		return
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	has_link = frappe.db.has_column("Booking Agent", "booking_company")
	if not has_link:
		return

	for row in frappe.get_all("Booking Agent", fields=["name", "agent_name", "booking_company"]):
		if row.booking_company:
			continue
		label = (row.agent_name or "").strip()
		if not label:
			continue
		company = create_booking_company(label, is_agency=0)
		frappe.db.set_value("Booking Agent", row.name, "booking_company", company.name, update_modified=False)

	frappe.db.commit()
