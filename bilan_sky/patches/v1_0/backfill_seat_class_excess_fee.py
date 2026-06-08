import frappe
from frappe.utils import flt


def execute():
	settings = frappe.get_single("BA Settings")
	default_excess_fee = flt(settings.excess_baggage_fee)

	for row in frappe.get_all("Seat Class", fields=["name", "excess_baggage_fee_per_kg"]):
		if flt(row.excess_baggage_fee_per_kg):
			continue
		frappe.db.set_value(
			"Seat Class",
			row.name,
			"excess_baggage_fee_per_kg",
			default_excess_fee,
			update_modified=False,
		)

	frappe.db.commit()
