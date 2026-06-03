# Copyright (c) 2026, NF and contributors

import json

import frappe

from bilan_sky.bilan_air_booking_system.utils.fare_pricing import normalize_base_fares


def execute():
	"""Populate base_fares / base_fares_override from legacy single fare fields."""
	settings = frappe.get_single("BA Settings")
	child_pct = float(settings.child_fare_percentage or 75)
	infant_pct = float(settings.infant_fare_percentage or 10)

	for route in frappe.get_all("Flight Route", fields=["name", "base_fare", "base_fares"]):
		if route.base_fares:
			continue
		if not route.base_fare:
			continue
		adult = float(route.base_fare)
		fares = {
			"adult": adult,
			"child": round(adult * child_pct / 100, 2),
			"infant": round(adult * infant_pct / 100, 2),
		}
		frappe.db.set_value("Flight Route", route.name, "base_fares", json.dumps(fares))

	for sched in frappe.get_all(
		"Flight Schedule",
		fields=["name", "base_fare_override", "base_fares_override"],
	):
		if sched.base_fares_override:
			continue
		if sched.base_fare_override in (None, ""):
			continue
		override = {"adult": float(sched.base_fare_override)}
		frappe.db.set_value(
			"Flight Schedule",
			sched.name,
			"base_fares_override",
			json.dumps(override),
		)

	frappe.db.commit()
