import frappe
from frappe.utils import flt


def execute():
	settings = frappe.get_single("BA Settings")
	default_checked = flt(settings.max_baggage_kg)
	default_carry_on = flt(settings.get("default_carry_on_kg") or 7)
	default_excess_fee = flt(settings.excess_baggage_fee)

	for row in frappe.get_all(
		"Seat Class",
		fields=["name", "checked_baggage_kg", "carry_on_kg", "excess_baggage_fee_per_kg"],
	):
		updates = {}
		if not flt(row.checked_baggage_kg):
			updates["checked_baggage_kg"] = default_checked
		if not flt(row.carry_on_kg):
			updates["carry_on_kg"] = default_carry_on
		if not flt(row.excess_baggage_fee_per_kg):
			updates["excess_baggage_fee_per_kg"] = default_excess_fee
		if updates:
			frappe.db.set_value("Seat Class", row.name, updates, update_modified=False)

	frappe.db.commit()
