# Copyright (c) 2026, NF and contributors

import frappe
from frappe.utils import cint


def get_ba_setting(fieldname: str, default=None):
	"""Read a BA Settings field safely (handles DB not yet migrated after JSON changes)."""
	meta = frappe.get_meta("BA Settings")
	if not meta.has_field(fieldname):
		return default
	value = frappe.db.get_single_value("BA Settings", fieldname)
	if value is None or value == "":
		return default
	return value


def get_ba_setting_from_doc(doc, fieldname: str, default=None):
	if not frappe.get_meta("BA Settings").has_field(fieldname):
		return default
	value = doc.get(fieldname)
	if value is None or value == "":
		return default
	return value


def is_seat_selection_enabled() -> bool:
	return bool(cint(get_ba_setting("enable_seat_selection", 0)))
