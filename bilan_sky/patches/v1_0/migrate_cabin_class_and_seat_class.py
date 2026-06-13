import frappe
from frappe.utils import cint, flt


DEFAULT_CABINS = [
	{"cabin_name": "Economy", "display_order": 1},
	{"cabin_name": "Business", "display_order": 2},
	{"cabin_name": "First Class", "display_order": 3},
]

LEGACY_CABIN_NAMES = {"Economy", "Business", "First Class"}


def execute():
	settings = frappe.get_single("BA Settings")
	default_checked = flt(settings.max_baggage_kg)
	default_carry_on = flt(settings.get("default_carry_on_kg") or 7)
	default_excess_fee = flt(settings.excess_baggage_fee)

	cabin_by_name: dict[str, str] = {}
	for spec in DEFAULT_CABINS:
		name = spec["cabin_name"]
		if frappe.db.exists("Cabin Class", name):
			cabin_by_name[name] = name
			continue
		doc = frappe.get_doc(
			{
				"doctype": "Cabin Class",
				"cabin_name": name,
				"display_order": spec["display_order"],
				"is_active": 1,
			}
		)
		doc.insert(ignore_permissions=True)
		cabin_by_name[name] = doc.name

	for row in frappe.get_all(
		"Seat Class",
		fields=[
			"name",
			"class_name",
			"checked_baggage_kg",
			"checked_baggage_pieces",
			"carry_on_kg",
			"carry_on_pieces",
			"excess_baggage_fee_per_kg",
			"cabin_class",
			"use_on_aircraft_layout",
		],
	):
		updates: dict = {}
		class_name = (row.class_name or "").strip()
		cabin_link = row.cabin_class

		if not cabin_link and class_name in LEGACY_CABIN_NAMES:
			cabin_link = cabin_by_name.get(class_name)
			if cabin_link:
				updates["cabin_class"] = cabin_link

		if class_name in LEGACY_CABIN_NAMES and not cint(row.use_on_aircraft_layout):
			updates["use_on_aircraft_layout"] = 1

		if updates:
			frappe.db.set_value("Seat Class", row.name, updates, update_modified=False)

		if class_name in LEGACY_CABIN_NAMES and cabin_link:
			cabin_updates = {}
			if not flt(frappe.db.get_value("Cabin Class", cabin_link, "checked_baggage_kg")):
				if flt(row.checked_baggage_kg):
					cabin_updates["checked_baggage_kg"] = row.checked_baggage_kg
				else:
					cabin_updates["checked_baggage_kg"] = default_checked
			if not flt(frappe.db.get_value("Cabin Class", cabin_link, "carry_on_kg")):
				if flt(row.carry_on_kg):
					cabin_updates["carry_on_kg"] = row.carry_on_kg
				else:
					cabin_updates["carry_on_kg"] = default_carry_on
			if not flt(frappe.db.get_value("Cabin Class", cabin_link, "excess_baggage_fee_per_kg")):
				if flt(row.excess_baggage_fee_per_kg):
					cabin_updates["excess_baggage_fee_per_kg"] = row.excess_baggage_fee_per_kg
				else:
					cabin_updates["excess_baggage_fee_per_kg"] = default_excess_fee
			if cabin_updates:
				frappe.db.set_value("Cabin Class", cabin_link, cabin_updates, update_modified=False)

	frappe.db.commit()
