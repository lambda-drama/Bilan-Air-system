# Copyright (c) 2026, NF and contributors

"""Resolve adult / child / infant base fares (economy) for routes and schedules."""

from __future__ import annotations

import json
from typing import Any

import frappe

PASSENGER_FARE_KEYS = ("adult", "child", "infant")

# Maps booking passenger types to fare JSON keys.
PASSENGER_TYPE_TO_KEY = {
	"adult": "adult",
	"child": "child",
	"infant": "infant",
}


def _row_val(row, field: str, default=None):
	if isinstance(row, dict):
		return row.get(field, default)
	return getattr(row, field, default)


def _parse_json_field(value: Any) -> dict | None:
	if value in (None, ""):
		return None
	if isinstance(value, dict):
		return value
	if isinstance(value, str):
		try:
			parsed = json.loads(value)
			return parsed if isinstance(parsed, dict) else None
		except json.JSONDecodeError:
			return None
	return None


def _settings_child_infant_from_adult(adult: float) -> tuple[float, float]:
	settings = frappe.get_single("BA Settings")
	child_pct = float(settings.child_fare_percentage or 75)
	infant_pct = float(settings.infant_fare_percentage or 10)
	return (
		round(adult * child_pct / 100, 2),
		round(adult * infant_pct / 100, 2),
	)


def normalize_base_fares(
	value: Any = None,
	*,
	legacy_adult: float | None = None,
) -> dict[str, float]:
	"""Return {adult, child, infant} with positive floats; fill gaps from settings."""
	raw = _parse_json_field(value) or {}
	result: dict[str, float] = {}

	adult = raw.get("adult")
	if adult in (None, "") and legacy_adult not in (None, ""):
		adult = legacy_adult
	if adult not in (None, ""):
		result["adult"] = round(float(adult), 2)

	if "adult" not in result:
		frappe.throw("Adult base fare is required.")

	child = raw.get("child")
	if child in (None, ""):
		result["child"], _ = _settings_child_infant_from_adult(result["adult"])
	else:
		result["child"] = round(float(child), 2)

	infant = raw.get("infant")
	if infant in (None, ""):
		_, result["infant"] = _settings_child_infant_from_adult(result["adult"])
	else:
		result["infant"] = round(float(infant), 2)

	return result


def parse_partial_fare_override(value: Any) -> dict[str, float] | None:
	"""Schedule override: only keys explicitly set are stored."""
	raw = _parse_json_field(value)
	if not raw:
		return None
	out: dict[str, float] = {}
	for key in PASSENGER_FARE_KEYS:
		val = raw.get(key)
		if val not in (None, ""):
			out[key] = round(float(val), 2)
	return out or None


def apply_schedule_fare_override(doc: Any, override_value: Any) -> None:
	"""Set base_fares_override and legacy base_fare_override on a schedule doc."""
	partial = parse_partial_fare_override(override_value)
	doc.base_fares_override = partial
	doc.base_fare_override = partial.get("adult") if partial else None


def passenger_type_to_fare_key(passenger_type: str | None) -> str:
	key = (passenger_type or "Adult").strip().lower()
	return PASSENGER_TYPE_TO_KEY.get(key, "adult")


def resolve_base_fares(schedule: Any, route: Any) -> dict[str, float]:
	"""Effective economy base fares for a schedule (override merges per type)."""
	route_fares = normalize_base_fares(
		_row_val(route, "base_fares"),
		legacy_adult=_row_val(route, "base_fare"),
	)
	override_raw = _parse_json_field(_row_val(schedule, "base_fares_override"))
	# Legacy single adult override
	if not override_raw and _row_val(schedule, "base_fare_override") not in (None, ""):
		override_raw = {"adult": _row_val(schedule, "base_fare_override")}

	if not override_raw:
		return route_fares

	merged = dict(route_fares)
	for key in PASSENGER_FARE_KEYS:
		val = override_raw.get(key)
		if val not in (None, ""):
			merged[key] = round(float(val), 2)
	return merged


def base_fare_for_passenger(
	schedule: Any,
	route: Any,
	passenger_type: str | None,
) -> float:
	fares = resolve_base_fares(schedule, route)
	key = passenger_type_to_fare_key(passenger_type)
	return fares[key]


def fare_rule_multiplier(route_name: str, departure_date) -> float:
	from frappe.utils import date_diff, getdate, nowdate

	days_before = date_diff(departure_date, getdate(nowdate()))
	fare_rule = frappe.get_all(
		"Fare Rule",
		filters={
			"route": route_name,
			"days_before_departure": [">=", days_before],
			"is_active": 1,
		},
		fields=["name"],
		order_by="days_before_departure asc",
		limit=1,
		ignore_permissions=True,
	)
	if not fare_rule:
		return 1.0
	rule = frappe.get_doc("Fare Rule", fare_rule[0].name, ignore_permissions=True)
	return 1 + (rule.price_increase_percentage / 100)


def economy_price_for_passenger(
	schedule: Any,
	route: Any,
	passenger_type: str | None,
	*,
	seat_class_multiplier: float = 1.0,
) -> float:
	base = base_fare_for_passenger(schedule, route, passenger_type)
	multiplier = fare_rule_multiplier(_row_val(route, "name"), _row_val(schedule, "departure_date"))
	return round(base * seat_class_multiplier * multiplier, 2)


def prices_for_schedule_search(schedule: Any, route: Any) -> dict[str, Any]:
	"""Seat-class prices (adult base) and per-passenger economy fares for search APIs."""
	fares = resolve_base_fares(schedule, route)
	fare_mult = fare_rule_multiplier(_row_val(route, "name"), _row_val(schedule, "departure_date"))
	seat_classes = frappe.get_all(
		"Seat Class",
		fields=["name", "class_name", "price_multiplier"],
		ignore_permissions=True,
	)
	prices = {}
	for seat_class in seat_classes:
		prices[_row_val(seat_class, "class_name")] = round(
			fares["adult"] * _row_val(seat_class, "price_multiplier") * fare_mult,
			2,
		)
	passenger_base = {
		key: round(fares[key] * fare_mult, 2) for key in PASSENGER_FARE_KEYS
	}
	return {"prices": prices, "base_fares": passenger_base}
