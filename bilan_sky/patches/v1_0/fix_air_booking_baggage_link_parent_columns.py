# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Add parent columns to Air Booking Baggage Link after istable was enabled."""
	table = "Air Booking Baggage Link"
	columns = {
		"parent": "varchar(140)",
		"parentfield": "varchar(140)",
		"parenttype": "varchar(140)",
	}

	for column, column_type in columns.items():
		if not frappe.db.has_column(table, column):
			frappe.db.sql(f"ALTER TABLE `tab{table}` ADD COLUMN `{column}` {column_type}")

	frappe.db.commit()
