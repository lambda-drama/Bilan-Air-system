"""Reservation Ref is auto-filled from document name; must not block Desk save."""

import frappe


def execute():
	if not frappe.db.table_exists("tabDocField"):
		return

	frappe.db.set_value(
		"DocField",
		{"parent": "Air Booking", "fieldname": "reservation_ref"},
		"reqd",
		0,
		update_modified=False,
	)

	for name in frappe.get_all(
		"Property Setter",
		filters={
			"doc_type": "Air Booking",
			"field_name": "reservation_ref",
			"property": "reqd",
		},
		pluck="name",
	):
		frappe.delete_doc("Property Setter", name, force=1, ignore_permissions=True)

	frappe.clear_cache(doctype="Air Booking")
