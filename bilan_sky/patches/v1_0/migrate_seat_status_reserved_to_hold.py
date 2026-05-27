import frappe


def execute():
	"""Migrate legacy Seat Inventory status from Reserved -> Hold."""
	if frappe.db.has_column("Seat Inventory", "status"):
		frappe.db.sql(
			"""
			UPDATE `tabSeat Inventory`
			SET status = 'Hold'
			WHERE status = 'Reserved'
			"""
		)
		frappe.db.commit()
