"""Map legacy confirmation_mode to explicit Booking Agent user-rights fields."""

import frappe
from frappe.utils import flt


def execute():
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	for row in frappe.get_all(
		"Booking Agent",
		fields=["name", "confirmation_mode", "credit_limit", "status"],
	):
		updates = {}
		if not frappe.db.has_column("Booking Agent", "can_book_ticket"):
			return

		if not frappe.db.get_value("Booking Agent", row.name, "can_book_ticket"):
			updates["can_book_ticket"] = "Yes"
		if not frappe.db.get_value("Booking Agent", row.name, "can_confirm_ticket"):
			updates["can_confirm_ticket"] = "Yes"
		if not frappe.db.get_value("Booking Agent", row.name, "deposit_required"):
			if row.confirmation_mode == "Credit Agent" and flt(row.credit_limit) > 0:
				updates["deposit_required"] = "No"
			else:
				updates["deposit_required"] = "Yes"
		if not frappe.db.get_value("Booking Agent", row.name, "user_type"):
			updates["user_type"] = "Agent"

		if updates:
			frappe.db.set_value("Booking Agent", row.name, updates, update_modified=False)
			doc = frappe.get_doc("Booking Agent", row.name)
			doc._sync_rights_mode()
			doc._sync_credit_flags()
			frappe.db.set_value(
				"Booking Agent",
				row.name,
				{
					"confirmation_mode": doc.confirmation_mode,
					"allow_credit": doc.allow_credit,
					"credit_limit": doc.credit_limit,
				},
				update_modified=False,
			)

	frappe.db.commit()
