"""Per seat-class baggage allowance with BA Settings fallbacks."""

from __future__ import annotations

import frappe
from frappe.utils import cint, flt


def _ba_settings():
	return frappe.get_single("BA Settings")


def get_default_baggage_policy():
	"""Global defaults from BA Settings (fallback when seat class has no override)."""
	settings = _ba_settings()
	checked_kg = flt(settings.max_baggage_kg)
	carry_on_kg = flt(settings.get("default_carry_on_kg") or 7)
	return {
		"checked_kg": checked_kg,
		"carry_on_kg": carry_on_kg,
		"checked_pieces": 1,
		"carry_on_pieces": 1,
		"max_baggage_kg": checked_kg,
		"excess_baggage_fee_per_kg": flt(settings.excess_baggage_fee),
	}


def resolve_seat_class_name(seat_class=None, seat_inventory_name=None):
	if seat_inventory_name and frappe.db.exists("Seat Inventory", seat_inventory_name):
		return frappe.db.get_value("Seat Inventory", seat_inventory_name, "seat_class")

	if not seat_class:
		return None

	if frappe.db.exists("Seat Class", seat_class):
		return seat_class

	return frappe.db.get_value("Seat Class", {"class_name": seat_class}, "name")


def get_baggage_allowance(seat_class=None, seat_inventory_name=None):
	"""Allowance for one passenger based on their seat class."""
	defaults = get_default_baggage_policy()
	seat_class_name = resolve_seat_class_name(seat_class, seat_inventory_name)

	checked_kg = defaults["checked_kg"]
	carry_on_kg = defaults["carry_on_kg"]
	checked_pieces = defaults["checked_pieces"]
	carry_on_pieces = defaults["carry_on_pieces"]
	seat_class_label = None

	excess_fee_per_kg = defaults["excess_baggage_fee_per_kg"]

	if seat_class_name:
		row = frappe.db.get_value(
			"Seat Class",
			seat_class_name,
			[
				"class_name",
				"checked_baggage_kg",
				"carry_on_kg",
				"checked_baggage_pieces",
				"carry_on_pieces",
				"excess_baggage_fee_per_kg",
			],
			as_dict=True,
		)
		if row:
			seat_class_label = row.class_name
			if flt(row.checked_baggage_kg) > 0:
				checked_kg = flt(row.checked_baggage_kg)
			if flt(row.carry_on_kg) > 0:
				carry_on_kg = flt(row.carry_on_kg)
			if cint(row.checked_baggage_pieces) > 0:
				checked_pieces = cint(row.checked_baggage_pieces)
			if cint(row.carry_on_pieces) > 0:
				carry_on_pieces = cint(row.carry_on_pieces)
			if flt(row.excess_baggage_fee_per_kg) > 0:
				excess_fee_per_kg = flt(row.excess_baggage_fee_per_kg)

	return {
		"checked_kg": checked_kg,
		"carry_on_kg": carry_on_kg,
		"checked_pieces": checked_pieces,
		"carry_on_pieces": carry_on_pieces,
		"max_baggage_kg": checked_kg,
		"excess_baggage_fee_per_kg": excess_fee_per_kg,
		"seat_class": seat_class_label,
		"seat_class_name": seat_class_name,
	}


def calculate_excess_fee(weight_kg, seat_class=None, seat_inventory_name=None):
	allowance = get_baggage_allowance(seat_class, seat_inventory_name)
	max_kg = allowance["checked_kg"]
	weight_kg = flt(weight_kg)
	if weight_kg <= 0:
		return {"weight_kg": 0, "is_excess": False, "fee": 0, "allowance_kg": max_kg}
	if weight_kg <= max_kg:
		return {"weight_kg": weight_kg, "is_excess": False, "fee": 0, "allowance_kg": max_kg}
	excess = weight_kg - max_kg
	fee = excess * allowance["excess_baggage_fee_per_kg"]
	return {"weight_kg": weight_kg, "is_excess": True, "fee": fee, "allowance_kg": max_kg}
