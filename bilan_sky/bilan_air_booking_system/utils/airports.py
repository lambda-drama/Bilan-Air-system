# Copyright (c) 2026, NF and contributors

import frappe


def resolve_airport_name(origin_or_iata: str) -> str | None:
	"""Resolve Airport document name from link name or IATA code."""
	code = (origin_or_iata or "").strip()
	if not code:
		return None
	if frappe.db.exists("Airport", code):
		return code
	return frappe.db.get_value("Airport", {"iata_code": code.upper()}, "name")


def get_airport_iata(airport_name: str) -> str | None:
	return frappe.db.get_value("Airport", airport_name, "iata_code")
