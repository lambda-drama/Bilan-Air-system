# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

"""IATA-style flight and route naming helpers.

Flight number format: {Airline IATA (2 letters)}{1-4 digit number}
  e.g. KQ100, BA2490

Route name format: {Origin IATA}-{Destination IATA}
  e.g. NBO-JFK

Each route has a series base (e.g. 103 → KQ103). The same flight number may run on
many dates; document name is ``{flight_number}-{departure_date}`` (e.g. KQ103-2026-06-15).
A second flight on the same route and date bumps the numeric part (+2, +4, …).
"""

import frappe
from frappe import _
from frappe.utils import cint, cstr, getdate


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


def schedule_document_name(flight_number: str, departure_date) -> str:
	"""Unique Flight Schedule primary key (flight number is reused across dates)."""
	return f"{cstr(flight_number).strip()}-{getdate(departure_date).isoformat()}"


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
	prefix = cstr(iata_code).strip().upper()
	departure_date = getdate(departure_date)

	offset = 0
	while True:
		flight_num = series_base + offset * 2
		if flight_num > 9999:
			frappe.throw(_("Flight number exceeds the valid range (max 9999) for this route."))

		candidate = f"{prefix}{flight_num}"
		filters = {"flight_number": candidate, "departure_date": departure_date}
		if exclude_name:
			filters["name"] = ["!=", exclude_name]

		if not frappe.db.exists("Flight Schedule", filters):
			return candidate

		offset += 1


def assert_unique_flight_number(flight_number: str, departure_date, exclude_name: str | None = None) -> None:
	filters = {"flight_number": flight_number, "departure_date": departure_date}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]

	if frappe.db.exists("Flight Schedule", filters):
		frappe.throw(
			_(
				"Flight {0} is already scheduled on {1}. Pick another date or use a different "
				"flight number for a second departure the same day."
			).format(flight_number, frappe.format(departure_date, {"fieldtype": "Date"}))
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
