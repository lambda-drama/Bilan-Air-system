"""Flight Setup level ticket prices and penalties."""

from __future__ import annotations

from typing import Any

import frappe
from frappe.utils import cint, flt

from bilan_sky.bilan_air_booking_system.utils.flight_setup import flight_setup_available
from bilan_sky.bilan_air_booking_system.utils.seat_class_utils import resolve_seat_class_ref


def _normalize_passenger_type(passenger_type: str | None) -> str:
	pt = (passenger_type or "Adult").strip().title()
	if pt not in ("Adult", "Child", "Infant"):
		return "Adult"
	return pt


def _seat_class_key(seat_class: str | None) -> str:
	return (seat_class or "").strip()


def _seat_class_meta(seat_class: str | None) -> dict[str, Any] | None:
	ref = resolve_seat_class_ref(seat_class)
	if not ref:
		return None
	return frappe.db.get_value(
		"Seat Class",
		ref,
		["name", "class_name", "cabin_class", "use_on_aircraft_layout"],
		as_dict=True,
	)


def _seat_classes_match_for_pricing(requested: str | None, stored: str | None) -> bool:
	"""Match fare codes by link, class_name, or layout↔bookable fare class in same cabin."""
	if not requested or not stored:
		return False
	if _seat_class_key(requested) == _seat_class_key(stored):
		return True

	req_ref = resolve_seat_class_ref(requested)
	sto_ref = resolve_seat_class_ref(stored)
	if req_ref and sto_ref and req_ref == sto_ref:
		return True

	req_row = _seat_class_meta(requested)
	sto_row = _seat_class_meta(stored)
	if not req_row or not sto_row:
		return False

	req_name = (req_row.class_name or req_row.name or "").strip()
	sto_name = (sto_row.class_name or sto_row.name or "").strip()
	if req_name and req_name == sto_name:
		return True

	if req_row.cabin_class != sto_row.cabin_class:
		return False

	req_layout = cint(req_row.use_on_aircraft_layout)
	sto_layout = cint(sto_row.use_on_aircraft_layout)
	if req_layout == sto_layout:
		return False

	fare_row = req_row if not req_layout else sto_row
	layout_row = req_row if req_layout else sto_row
	layout_code = (layout_row.class_name or layout_row.name or "").strip()
	fare_code = (fare_row.class_name or fare_row.name or "").strip()
	if not layout_code or not fare_code:
		return False
	if fare_code == layout_code:
		return True
	if fare_code.startswith(f"{layout_code} ") or fare_code.startswith(layout_code):
		return True

	if cint(layout_row.use_on_aircraft_layout):
		fare_count = frappe.db.count(
			"Seat Class",
			{
				"cabin_class": fare_row.cabin_class,
				"is_active": 1,
				"use_on_aircraft_layout": 0,
			},
		)
		if fare_count == 1:
			return True
	return False


def get_flight_setup_doc(flight_number: str | None):
	if not flight_setup_available() or not flight_number:
		return None
	flight_number = flight_number.strip()
	if not flight_number or not frappe.db.exists("Flight Setup", flight_number):
		return None
	return frappe.get_doc("Flight Setup", flight_number)


def get_flight_setup_price_row(
	flight_number: str | None,
	seat_class: str | None,
	passenger_type: str | None,
) -> dict[str, Any] | None:
	doc = get_flight_setup_doc(flight_number)
	if not doc:
		return None
	seat_class = _seat_class_key(seat_class)
	pt = _normalize_passenger_type(passenger_type)
	if not seat_class:
		return None
	for row in doc.get("flight_prices") or []:
		if _seat_classes_match_for_pricing(seat_class, row.seat_class) and _normalize_passenger_type(
			row.passenger_type
		) == pt:
			return row.as_dict()
	return None


def flight_setup_fare(
	flight_number: str | None,
	seat_class: str | None,
	passenger_type: str | None,
) -> float | None:
	row = get_flight_setup_price_row(flight_number, seat_class, passenger_type)
	if not row:
		return None
	fare = row.get("fare")
	if fare in (None, ""):
		return None
	return round(flt(fare), 2)


def flight_setup_prices_for_api(doc) -> list[dict[str, Any]]:
	rows = []
	for row in doc.get("flight_prices") or []:
		rows.append(
			{
				"name": row.name,
				"seat_class": row.seat_class,
				"passenger_type": row.passenger_type,
				"tax_group_name": row.tax_group_name,
				"surcharge_group_name": row.surcharge_group_name,
				"fare": flt(row.fare),
				"non_base_agent_commission": flt(row.non_base_agent_commission),
				"base_agent_commission": flt(row.base_agent_commission),
				"baggage_pieces": cint(row.baggage_pieces),
				"baggage_weight_kg": cint(row.baggage_weight_kg),
				"hand_carry_pieces": cint(row.hand_carry_pieces),
				"hand_carry_weight_kg": cint(row.hand_carry_weight_kg),
			}
		)
	return rows


def flight_setup_penalties_for_api(doc) -> list[dict[str, Any]]:
	rows = []
	for row in doc.get("flight_penalties") or []:
		rows.append(
			{
				"name": row.name,
				"penalty_type": row.penalty_type,
				"amount": flt(row.amount),
				"applies_when": row.applies_when,
				"route": row.route,
				"flight_schedule": row.flight_schedule,
				"description": row.description,
			}
		)
	return rows


def _ensure_flight_setup_child_table(doc, fieldname: str) -> None:
	if doc.meta.get_field(fieldname):
		return
	frappe.throw(
		_(
			"Flight Setup is missing the {0} table. Run bench migrate on this site, then try again."
		).format(fieldname),
		title=_("Database update required"),
	)


def apply_flight_setup_prices(doc, rows: list[dict] | None) -> None:
	if rows is None:
		return
	_ensure_flight_setup_child_table(doc, "flight_prices")
	doc.set("flight_prices", [])
	for row in rows or []:
		if not row.get("seat_class") or row.get("fare") in (None, ""):
			continue
		doc.append(
			"flight_prices",
			{
				"seat_class": row.get("seat_class"),
				"passenger_type": _normalize_passenger_type(row.get("passenger_type")),
				"tax_group_name": row.get("tax_group_name") or "",
				"surcharge_group_name": row.get("surcharge_group_name") or "",
				"fare": flt(row.get("fare")),
				"non_base_agent_commission": flt(row.get("non_base_agent_commission")),
				"base_agent_commission": flt(row.get("base_agent_commission")),
				"baggage_pieces": cint(row.get("baggage_pieces")),
				"baggage_weight_kg": cint(row.get("baggage_weight_kg")),
				"hand_carry_pieces": cint(row.get("hand_carry_pieces")),
				"hand_carry_weight_kg": cint(row.get("hand_carry_weight_kg")),
			},
		)


def apply_flight_setup_penalties(doc, rows: list[dict] | None) -> None:
	if rows is None:
		return
	_ensure_flight_setup_child_table(doc, "flight_penalties")
	doc.set("flight_penalties", [])
	for row in rows or []:
		if not row.get("penalty_type") or row.get("amount") in (None, ""):
			continue
		doc.append(
			"flight_penalties",
			{
				"penalty_type": row.get("penalty_type"),
				"amount": flt(row.get("amount")),
				"applies_when": row.get("applies_when") or "Any time",
				"route": row.get("route") or None,
				"flight_schedule": row.get("flight_schedule") or None,
				"description": row.get("description") or "",
			},
		)
