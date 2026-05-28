# bilan_air/api/search.py

import frappe
from frappe.utils import add_days, getdate, nowdate

from bilan_sky.bilan_air_booking_system.utils.airports import (
	get_airport_iata,
	resolve_airport_name,
)


def _public_get_all(doctype, *args, **kwargs):
	"""Guest site search must not depend on Desk role permissions."""
	kwargs.setdefault("ignore_permissions", True)
	return frappe.get_all(doctype, *args, **kwargs)


def _normalize_departure_date(date):
	return getdate(date)


def _count_available_seats(schedule_name):
	return frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule_name, "status": "Available"},
	)


def _count_schedules_on_date(route_name, departure_date):
	return frappe.db.count(
		"Flight Schedule",
		{
			"route": route_name,
			"departure_date": _normalize_departure_date(departure_date),
			"status": ["in", ["Scheduled", "Delayed"]],
			"docstatus": 1,
		},
	)


def _row_val(row, field):
	"""Read a field from frappe get_all rows (dict) or Document."""
	if isinstance(row, dict):
		return row.get(field)
	return getattr(row, field, None)


def _fare_multiplier(route_name, departure_date):
	days_before = frappe.utils.date_diff(departure_date, nowdate())
	fare_rule = _public_get_all(
		"Fare Rule",
		filters={
			"route": route_name,
			"days_before_departure": [">=", days_before],
		},
		order_by="days_before_departure asc",
		limit=1,
	)
	if not fare_rule:
		return 1.0
		rule = frappe.get_doc("Fare Rule", _row_val(fare_rule[0], "name"), ignore_permissions=True)
	return 1 + (rule.price_increase_percentage / 100)


def _prices_for_schedule(schedule, route_base_fare, route_name):
	seat_classes = _public_get_all(
		"Seat Class",
		fields=["name", "class_name", "price_multiplier"],
	)
	base_fare = _row_val(schedule, "base_fare_override") or route_base_fare
	multiplier = _fare_multiplier(route_name, _row_val(schedule, "departure_date"))
	prices = {}
	for seat_class in seat_classes:
		prices[_row_val(seat_class, "class_name")] = round(
			base_fare * _row_val(seat_class, "price_multiplier") * multiplier, 2
		)
	return prices


def _schedule_to_flight_result(schedule, route_base_fare, route_name, passengers):
	schedule_name = _row_val(schedule, "name")
	available = _count_available_seats(schedule_name)
	if available < int(passengers):
		return None

	return {
		"flight_number": _row_val(schedule, "flight_number"),
		"schedule_id": schedule_name,
		"departure_time": _row_val(schedule, "departure_time"),
		"arrival_time": _row_val(schedule, "arrival_time"),
		"available_seats": available,
		"prices": _prices_for_schedule(schedule, route_base_fare, route_name),
		"route": route_name,
	}


def _find_schedules_for_routes(routes, date, passengers):
	"""Schedules belong to a Flight Route; route defines origin/destination airports."""
	results = []
	for route in routes:
		route_name = _row_val(route, "name")
		route_base_fare = _row_val(route, "base_fare")
		departure_date = _normalize_departure_date(date)
		schedules = _public_get_all(
			"Flight Schedule",
			filters={
				"route": route_name,
				"departure_date": departure_date,
				"status": ["in", ["Scheduled", "Delayed"]],
				"docstatus": 1,
			},
			fields=[
				"name",
				"flight_number",
				"departure_date",
				"departure_time",
				"arrival_date",
				"arrival_time",
				"base_fare_override",
				"airplane",
			],
		)
		for schedule in schedules:
			item = _schedule_to_flight_result(
				schedule, route_base_fare, route_name, passengers
			)
			if item:
				results.append(item)
	return results


@frappe.whitelist(allow_guest=True)
def find_flights(origin=None, destination=None, date=None, passengers=1, route=None):
	"""
	Search flight schedules for booking.

	- Pass ``route`` (Flight Route name) to search by route directly.
	- Or pass ``origin`` and ``destination`` (airport link name or IATA); active routes
	  matching those airports are used, then schedules on the selected date.
	"""
	if not date:
		return {"error": "Departure date is required", "flights": []}

	date = _normalize_departure_date(date)
	passengers = int(passengers or 1)
	origin_iata = origin
	destination_iata = destination

	if route:
		if not frappe.db.exists("Flight Route", route):
			return {"error": "Route not found", "flights": []}
		route_doc = frappe.get_doc("Flight Route", route, ignore_permissions=True)
		if not route_doc.is_active:
			return {"error": "This route is not active", "flights": []}
		routes = [{"name": route_doc.name, "base_fare": route_doc.base_fare}]
		origin_iata = get_airport_iata(route_doc.origin_airport) or origin
		destination_iata = get_airport_iata(route_doc.destination_airport) or destination
	else:
		if not origin or not destination:
			return {
				"error": "Select a route, or enter origin and destination airports",
				"flights": [],
			}

		origin_airport = resolve_airport_name(origin)
		destination_airport = resolve_airport_name(destination)

		if not origin_airport or not destination_airport:
			return {"error": "Unknown origin or destination airport", "flights": []}

		routes = _public_get_all(
			"Flight Route",
			filters={
				"origin_airport": origin_airport,
				"destination_airport": destination_airport,
				"is_active": 1,
			},
			fields=["name", "base_fare"],
		)

		if not routes:
			return {
				"error": "No active route for these airports. Check From/To or pick a route.",
				"flights": [],
			}

	results = _find_schedules_for_routes(routes, date, passengers)

	if not results:
		scheduled_count = sum(
			_count_schedules_on_date(_row_val(r, "name"), date) for r in routes
		)
		if scheduled_count > 0:
			# Schedules exist but no bookable seats — try generating inventory once (e.g. after submit).
			departure_date = _normalize_departure_date(date)
			for route in routes:
				route_name = _row_val(route, "name")
				schedules = _public_get_all(
					"Flight Schedule",
					filters={
						"route": route_name,
						"departure_date": departure_date,
						"status": ["in", ["Scheduled", "Delayed"]],
						"docstatus": 1,
					},
					fields=["name"],
				)
				for sched in schedules:
					schedule_name = _row_val(sched, "name")
					if _count_available_seats(schedule_name) >= passengers:
						continue
					try:
						doc = frappe.get_doc(
							"Flight Schedule", schedule_name, ignore_permissions=True
						)
						doc.generate_seat_inventory(raise_on_error=False)
					except Exception:
						frappe.log_error(
							title="Public flight search seat generation",
							message=frappe.get_traceback(),
						)
			results = _find_schedules_for_routes(routes, date, passengers)

	if not results:
		scheduled_count = sum(
			_count_schedules_on_date(_row_val(r, "name"), date) for r in routes
		)
		if scheduled_count > 0:
			error = (
				"Flights are scheduled on this date but no seats are available to book. "
				"Staff should open the flight schedule in Desk and ensure seat inventory is generated."
			)
		else:
			error = "No flights found for this route on the selected date"

		return {
			"error": error,
			"flights": [],
			"origin": origin_iata,
			"destination": destination_iata,
			"date": str(date),
			"passengers": passengers,
			"route": route,
			"scheduled_count": scheduled_count,
		}

	return {
		"origin": origin_iata,
		"destination": destination_iata,
		"date": date,
		"passengers": passengers,
		"route": route,
		"flights": results,
	}


@frappe.whitelist(allow_guest=True)
def get_schedule_for_office_booking(schedule_id, passengers=1):
	"""Load one flight schedule for portal office booking (skip search step)."""
	if not schedule_id or not frappe.db.exists("Flight Schedule", schedule_id):
		return {"error": "Flight schedule not found"}

	schedule = frappe.get_doc("Flight Schedule", schedule_id, ignore_permissions=True)
	if schedule.status not in ("Scheduled", "Delayed"):
		return {
			"error": f"Cannot book: flight status is {schedule.status}",
		}

	route = frappe.get_doc("Flight Route", schedule.route, ignore_permissions=True)
	flight = _schedule_to_flight_result(
		schedule, route.base_fare, route.name, int(passengers or 1)
	)
	if not flight:
		return {"error": "Not enough seats available on this flight"}

	return {
		"flight": flight,
		"route": route.name,
		"origin_iata": get_airport_iata(route.origin_airport),
		"destination_iata": get_airport_iata(route.destination_airport),
		"date": schedule.departure_date,
	}


@frappe.whitelist(allow_guest=True)
def fetch_all_available_routes():
	"""Get all available routes with airport details"""

	routes = _public_get_all(
		"Flight Route",
		filters={"is_active": 1},
		fields=["name", "route_name", "origin_airport", "destination_airport", "base_fare"],
	)

	for route in routes:
		origin = frappe.get_doc("Airport", route.origin_airport, ignore_permissions=True)
		destination = frappe.get_doc("Airport", route.destination_airport, ignore_permissions=True)

		route["origin_name"] = origin.airport_name
		route["origin_city"] = origin.city
		route["origin_code"] = origin.iata_code
		route["destination_name"] = destination.airport_name
		route["destination_city"] = destination.city
		route["destination_code"] = destination.iata_code

	return routes


@frappe.whitelist(allow_guest=True)
def get_booking_search_defaults():
	"""Suggested origin/destination/date for portal 'New booking' link."""
	routes = _public_get_all(
		"Flight Route",
		filters={"is_active": 1},
		fields=["name", "origin_airport", "destination_airport"],
		order_by="modified desc",
		limit=1,
	)
	if not routes:
		airports = _public_get_all(
			"Airport",
			filters={"is_active": 1},
			fields=["iata_code"],
			order_by="city asc",
			limit=2,
		)
		origin_iata = airports[0].iata_code if len(airports) > 0 else ""
		destination_iata = airports[1].iata_code if len(airports) > 1 else origin_iata
		return {
			"origin_iata": origin_iata,
			"destination_iata": destination_iata,
			"suggested_date": add_days(nowdate(), 1),
			"route": None,
		}

	route = routes[0]
	origin_iata = get_airport_iata(route.origin_airport) or ""
	destination_iata = get_airport_iata(route.destination_airport) or ""

	upcoming = _public_get_all(
		"Flight Schedule",
		filters={
			"route": route.name,
			"departure_date": [">=", nowdate()],
			"status": ["in", ["Scheduled", "Delayed"]],
			"docstatus": 1,
		},
		fields=["departure_date"],
		order_by="departure_date asc",
		limit=1,
	)

	suggested_date = upcoming[0].departure_date if upcoming else add_days(nowdate(), 1)

	return {
		"origin_iata": origin_iata,
		"destination_iata": destination_iata,
		"suggested_date": suggested_date,
		"route": route.name,
	}
