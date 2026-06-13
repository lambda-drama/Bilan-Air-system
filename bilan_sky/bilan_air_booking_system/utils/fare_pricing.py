# Copyright (c) 2026, NF and contributors

"""Resolve adult / child / infant base fares (economy) for routes and schedules."""

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe.utils import flt

PASSENGER_FARE_KEYS = ("adult", "child", "infant")

PASSENGER_TYPE_TO_KEY = {
	"adult": "adult",
	"child": "child",
	"infant": "infant",
}

ROUTE_FARE_FIELDS = {
	"adult": "base_fare_adult",
	"child": "base_fare_child",
	"infant": "base_fare_infant",
}

SCHEDULE_OVERRIDE_FIELDS = {
	"adult": "base_fare_adult_override",
	"child": "base_fare_child_override",
	"infant": "base_fare_infant_override",
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


def read_route_fares_from_doc(route: Any) -> dict[str, float]:
	"""Read route fares from Currency columns (falls back to legacy JSON/base_fare)."""
	adult = _row_val(route, ROUTE_FARE_FIELDS["adult"])
	child = _row_val(route, ROUTE_FARE_FIELDS["child"])
	infant = _row_val(route, ROUTE_FARE_FIELDS["infant"])

	if adult in (None, ""):
		legacy_json = _parse_json_field(_row_val(route, "base_fares"))
		if legacy_json and legacy_json.get("adult") not in (None, ""):
			adult = legacy_json.get("adult")
			child = child if child not in (None, "") else legacy_json.get("child")
			infant = infant if infant not in (None, "") else legacy_json.get("infant")
		elif _row_val(route, "base_fare") not in (None, ""):
			adult = _row_val(route, "base_fare")

	if adult in (None, ""):
		frappe.throw("Adult base fare is required.")

	adult = round(float(adult), 2)
	if child in (None, ""):
		child, infant_default = _settings_child_infant_from_adult(adult)
		infant = infant if infant not in (None, "") else infant_default
	else:
		child = round(float(child), 2)
	if infant in (None, ""):
		_, infant = _settings_child_infant_from_adult(adult)
	else:
		infant = round(float(infant), 2)

	return {"adult": adult, "child": child, "infant": infant}


def sync_route_base_fare_fields(route: Any) -> dict[str, float]:
	"""Normalize and persist route fare columns (+ legacy base_fare)."""
	fares = read_route_fares_from_doc(route)
	for key in PASSENGER_FARE_KEYS:
		route.set(ROUTE_FARE_FIELDS[key], fares[key])
	if hasattr(route, "base_fare"):
		route.base_fare = fares["adult"]
	if hasattr(route, "base_fares"):
		route.base_fares = None
	return fares


def read_schedule_overrides(schedule: Any) -> dict[str, float] | None:
	"""Partial overrides: only non-empty override columns apply."""
	overrides: dict[str, float] = {}
	for key, field in SCHEDULE_OVERRIDE_FIELDS.items():
		val = _row_val(schedule, field)
		if val not in (None, ""):
			overrides[key] = round(float(val), 2)

	if overrides:
		return overrides

	legacy_json = _parse_json_field(_row_val(schedule, "base_fares_override"))
	if legacy_json:
		for key in PASSENGER_FARE_KEYS:
			val = legacy_json.get(key)
			if val not in (None, ""):
				overrides[key] = round(float(val), 2)
		return overrides or None

	if _row_val(schedule, "base_fare_override") not in (None, ""):
		return {"adult": round(float(_row_val(schedule, "base_fare_override")), 2)}
	return None


def apply_schedule_fare_overrides(
	doc: Any,
	*,
	adult=None,
	child=None,
	infant=None,
	override_dict: dict | None = None,
) -> None:
	"""Set per-type override Currency fields on schedule/plan (empty = use route fare)."""
	values: dict[str, Any] = {}
	if override_dict is not None:
		if isinstance(override_dict, str):
			override_dict = _parse_json_field(override_dict)
		if override_dict:
			values = override_dict
	else:
		if adult is not None:
			values["adult"] = adult
		if child is not None:
			values["child"] = child
		if infant is not None:
			values["infant"] = infant

	for key, field in SCHEDULE_OVERRIDE_FIELDS.items():
		val = values.get(key)
		if val in (None, ""):
			doc.set(field, None)
		else:
			doc.set(field, round(float(val), 2))

	if hasattr(doc, "base_fares_override"):
		doc.base_fares_override = None
	if hasattr(doc, "base_fare_override"):
		doc.base_fare_override = None


def apply_schedule_fare_override(doc: Any, override_value: Any) -> None:
	"""API compat: dict/JSON partial override → Currency columns."""
	if override_value in (None, ""):
		apply_schedule_fare_overrides(doc, override_dict={})
		return
	if isinstance(override_value, dict) or isinstance(override_value, str):
		apply_schedule_fare_overrides(doc, override_dict=override_value)
		return
	apply_schedule_fare_overrides(doc, adult=override_value)


def normalize_base_fares(value: Any = None, *, legacy_adult: float | None = None) -> dict[str, float]:
	"""API/helper: build fare dict from JSON payload or legacy adult only."""
	class _Route:
		pass

	r = _Route()
	r.base_fare_adult = None
	r.base_fare_child = None
	r.base_fare_infant = None
	r.base_fares = value
	r.base_fare = legacy_adult
	return read_route_fares_from_doc(r)


def resolve_base_fares(schedule: Any, route: Any) -> dict[str, float]:
	route_fares = read_route_fares_from_doc(route)
	override = read_schedule_overrides(schedule)
	if not override:
		return route_fares

	merged = dict(route_fares)
	for key in PASSENGER_FARE_KEYS:
		if key in override:
			merged[key] = override[key]
	return merged


def passenger_type_to_fare_key(passenger_type: str | None) -> str:
	key = (passenger_type or "Adult").strip().lower()
	return PASSENGER_TYPE_TO_KEY.get(key, "adult")


def base_fare_for_passenger(schedule: Any, route: Any, passenger_type: str | None) -> float:
	fares = resolve_base_fares(schedule, route)
	return fares[passenger_type_to_fare_key(passenger_type)]


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
	from bilan_sky.bilan_air_booking_system.utils.seat_class_utils import list_bookable_fare_classes

	fares = resolve_base_fares(schedule, route)
	fare_mult = fare_rule_multiplier(_row_val(route, "name"), _row_val(schedule, "departure_date"))
	seat_classes = list_bookable_fare_classes()
	prices = {}
	for seat_class in seat_classes:
		prices[seat_class["class_name"]] = round(
			fares["adult"] * flt(seat_class.get("price_multiplier")) * fare_mult,
			2,
		)
	passenger_base = {key: round(fares[key] * fare_mult, 2) for key in PASSENGER_FARE_KEYS}
	return {"prices": prices, "base_fares": passenger_base}


def schedule_fare_override_for_api(doc: Any) -> dict[str, float | None]:
	"""Flat override fields for portal forms."""
	raw = read_schedule_overrides(doc)
	if not raw:
		return {"base_fare_adult_override": None, "base_fare_child_override": None, "base_fare_infant_override": None}
	return {
		"base_fare_adult_override": raw.get("adult"),
		"base_fare_child_override": raw.get("child"),
		"base_fare_infant_override": raw.get("infant"),
	}


def normalize_route_fare_payload(payload: dict) -> None:
	"""Map API/portal `base_fares` object to Currency columns (in-place)."""
	if "base_fares" in payload:
		raw = payload.pop("base_fares")
		if isinstance(raw, str):
			raw = _parse_json_field(raw)
		if isinstance(raw, dict):
			for key in PASSENGER_FARE_KEYS:
				val = raw.get(key)
				if val not in (None, ""):
					payload[ROUTE_FARE_FIELDS[key]] = val
	if payload.get("base_fare") not in (None, "") and not payload.get(ROUTE_FARE_FIELDS["adult"]):
		payload[ROUTE_FARE_FIELDS["adult"]] = payload.pop("base_fare", None) or payload.get(
			ROUTE_FARE_FIELDS["adult"]
		)


def normalize_schedule_override_payload(payload: dict) -> None:
	"""Map legacy `base_fares_override` JSON to override Currency columns (in-place)."""
	if "base_fares_override" in payload:
		raw = payload.pop("base_fares_override")
		if isinstance(raw, str):
			raw = _parse_json_field(raw)
		if isinstance(raw, dict):
			for key in PASSENGER_FARE_KEYS:
				val = raw.get(key)
				field = SCHEDULE_OVERRIDE_FIELDS[key]
				if val not in (None, ""):
					payload[field] = val
				elif field in payload:
					payload[field] = None
	if "base_fare_override" in payload:
		val = payload.pop("base_fare_override", None)
		if val not in (None, ""):
			payload[SCHEDULE_OVERRIDE_FIELDS["adult"]] = val


def pop_and_apply_schedule_overrides(doc: Any, data: dict) -> None:
	"""Apply legacy JSON override keys; leave explicit Currency fields for doc.update."""
	normalize_schedule_override_payload(data)
	if "base_fares_override" in data:
		apply_schedule_fare_override(doc, data.pop("base_fares_override"))
	elif "base_fare_override" in data:
		raw = data.pop("base_fare_override")
		apply_schedule_fare_override(doc, {"adult": raw} if raw not in (None, "") else None)


def route_fares_for_api(route: Any) -> dict:
	fares = read_route_fares_from_doc(route)
	return {
		"base_fare_adult": fares["adult"],
		"base_fare_child": fares["child"],
		"base_fare_infant": fares["infant"],
		"base_fares": fares,
		"base_fare": fares["adult"],
	}
