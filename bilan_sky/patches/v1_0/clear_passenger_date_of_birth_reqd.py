"""Date of birth is optional for Passenger profiles."""

import frappe


def execute():
	if not frappe.db.table_exists("tabDocField"):
		return

	frappe.db.set_value(
		"DocField",
		{"parent": "Passenger", "fieldname": "date_of_birth"},
		"reqd",
		0,
		update_modified=False,
	)

	for name in frappe.get_all(
		"Property Setter",
		filters={
			"doc_type": "Passenger",
			"field_name": "date_of_birth",
			"property": "reqd",
		},
		pluck="name",
	):
		frappe.delete_doc("Property Setter", name, force=1, ignore_permissions=True)

	frappe.clear_cache(doctype="Passenger")
