# Copyright (c) 2026, NF and contributors

import frappe


def get_ba_setting(fieldname: str, default=None):
	"""Read a BA Settings field safely (handles DB not yet migrated after JSON changes)."""
	meta = frappe.get_meta("BA Settings")
	if not meta.has_field(fieldname):
		return default
	return frappe.db.get_single_value("BA Settings", fieldname) or default


def get_ba_setting_from_doc(doc, fieldname: str, default=None):
	if not frappe.get_meta("BA Settings").has_field(fieldname):
		return default
	return doc.get(fieldname) or default
