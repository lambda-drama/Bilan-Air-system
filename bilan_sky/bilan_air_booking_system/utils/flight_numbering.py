# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

"""IATA-style flight and route naming helpers.

Flight number format: {Airline IATA (2 letters)}{1-4 digit number}
  e.g. KQ100, BA2490

Route name format: {Origin IATA}-{Destination IATA}
  e.g. NBO-JFK

Numeric part uses a per-route series base; each new schedule on that route
increments by 2 (odd numbers for outbound legs, per common practice).
Flight Schedule document name is the flight number (e.g. KQ100).
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr


def format_route_name(origin_airport: str, destination_airport: str) -> str:
	origin = _get_airport_iata(origin_airport)
	destination = _get_airport_iata(destination_airport)
	return f"{origin}-{destination}"


def get_next_flight_series_base() -> int:
	last = frappe.db.sql("SELECT MAX(flight_series_base) FROM `tabFlight Route`")
	next_base = cint(last[0][0] if last and last[0][0] else 0) + 1
	if next_base < 100:
		next_base = 100
	if next_base > 9999:
		frappe.throw(_("No more flight number series available (max 9999)."))
	return next_base


def ensure_route_series_base(route_doc) -> int:
	if route_doc.flight_series_base:
		return cint(route_doc.flight_series_base)

	base = get_next_flight_series_base()
	route_doc.flight_series_base = base
	if route_doc.name and not route_doc.is_new():
		frappe.db.set_value(
			"Flight Route", route_doc.name, "flight_series_base", base, update_modified=False
		)
	return base


def generate_flight_number(
	*,
	airplane: str,
	route: str,
	departure_date,
	exclude_name: str | None = None,
) -> str:
	airline = frappe.db.get_value("Airplane", airplane, "airline")
	if not airline:
		frappe.throw(_("Select an airplane with a linked airline to generate the flight number."))

	iata_code = frappe.db.get_value("Airline", airline, "iata_code")
	if not iata_code:
		frappe.throw(
			_("Airline {0} has no IATA code. Set a 2-letter IATA code on the airline.").format(airline)
		)

	route_doc = frappe.get_cached_doc("Flight Route", route)
	series_base = ensure_route_series_base(route_doc)

	filters = {"route": route}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]

	existing_count = frappe.db.count("Flight Schedule", filters)
	flight_num = series_base + existing_count * 2

	if flight_num > 9999:
		frappe.throw(_("Flight number exceeds the valid range (max 9999) for this route."))

	return f"{cstr(iata_code).strip().upper()}{flight_num}"


def assert_unique_flight_number(flight_number: str, departure_date, exclude_name: str | None = None) -> None:
	filters = {"flight_number": flight_number, "departure_date": departure_date}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]

	if frappe.db.exists("Flight Schedule", filters):
		frappe.throw(
			_("Flight number {0} already exists on {1}.").format(
				flight_number, frappe.format(departure_date, {"fieldtype": "Date"})
			)
		)


@frappe.whitelist()
def preview_flight_number(airplane: str, route: str, departure_date: str) -> str:
	return generate_flight_number(
		airplane=airplane,
		route=route,
		departure_date=departure_date,
	)


def _get_airport_iata(airport: str) -> str:
	iata = frappe.db.get_value("Airport", airport, "iata_code")
	if not iata:
		frappe.throw(_("Airport {0} has no IATA code.").format(airport))
	return cstr(iata).strip().upper()
