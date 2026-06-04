"""Copy JSON base fare fields into adult/child/infant Currency columns."""

import json

import frappe

from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
	SCHEDULE_OVERRIDE_FIELDS,
	_parse_json_field,
)


def execute():
	settings = frappe.get_single("BA Settings")
	child_pct = float(settings.child_fare_percentage or 75)
	infant_pct = float(settings.infant_fare_percentage or 10)

	if frappe.db.has_column("Flight Route", "base_fare_adult"):
		for route in frappe.get_all(
			"Flight Route",
			fields=["name", "base_fare", "base_fares", "base_fare_adult", "base_fare_child", "base_fare_infant"],
		):
			if route.base_fare_adult not in (None, ""):
				continue
			raw = _parse_json_field(route.base_fares) if frappe.db.has_column("Flight Route", "base_fares") else None
			adult = None
			child = None
			infant = None
			if raw:
				adult = raw.get("adult")
				child = raw.get("child")
				infant = raw.get("infant")
			if adult in (None, "") and route.base_fare not in (None, ""):
				adult = route.base_fare
			if adult in (None, ""):
				continue
			adult = float(adult)
			if child in (None, ""):
				child = round(adult * child_pct / 100, 2)
			else:
				child = float(child)
			if infant in (None, ""):
				infant = round(adult * infant_pct / 100, 2)
			else:
				infant = float(infant)
			frappe.db.set_value(
				"Flight Route",
				route.name,
				{
					"base_fare_adult": adult,
					"base_fare_child": child,
					"base_fare_infant": infant,
					"base_fare": adult,
				},
				update_modified=False,
			)

	for doctype in ("Flight Schedule", "Flight Schedule Plan"):
		if not frappe.db.has_column(doctype, "base_fare_adult_override"):
			continue
		json_field = "base_fares_override" if frappe.db.has_column(doctype, "base_fares_override") else None
		legacy_field = "base_fare_override" if frappe.db.has_column(doctype, "base_fare_override") else None
		fields = ["name", "base_fare_adult_override", "base_fare_child_override", "base_fare_infant_override"]
		if json_field:
			fields.append(json_field)
		if legacy_field:
			fields.append(legacy_field)

		for row in frappe.get_all(doctype, fields=fields):
			if row.base_fare_adult_override not in (None, ""):
				continue
			raw = _parse_json_field(getattr(row, json_field, None)) if json_field else None
			if not raw and legacy_field and getattr(row, legacy_field, None) not in (None, ""):
				raw = {"adult": float(getattr(row, legacy_field))}
			if not raw:
				continue
			updates = {}
			for key, col in SCHEDULE_OVERRIDE_FIELDS.items():
				val = raw.get(key)
				if val not in (None, ""):
					updates[col] = float(val)
			if updates:
				frappe.db.set_value(doctype, row.name, updates, update_modified=False)

	frappe.db.commit()
