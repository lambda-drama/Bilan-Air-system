# bilan_air/api/search.py

import frappe
from frappe.utils import add_days, getdate, nowdate

from bilan_sky.bilan_air_booking_system.utils.airports import (
	airport_display_label,
	get_airport_iata,
	resolve_airport_name,
)
from bilan_sky.bilan_air_booking_system.utils.fare_pricing import prices_for_schedule_search
from bilan_sky.bilan_air_booking_system.utils.portal_access import user_has_portal_access


def _public_get_all(doctype, *args, **kwargs):
	"""Guest site search must not depend on Desk role permissions."""
	kwargs.setdefault("ignore_permissions", True)
	return frappe.get_all(doctype, *args, **kwargs)


def _normalize_departure_date(date):
	return getdate(date)


def _bookable_schedule_filters(route_name, departure_date):
	"""Public site: submitted schedules only. Portal staff: draft + submitted."""
	filters = {
		"route": route_name,
		"departure_date": _normalize_departure_date(departure_date),
		"status": ["in", ["Scheduled", "Delayed"]],
		"is_active": 1,
	}
	if user_has_portal_access():
		filters["docstatus"] = ["in", [0, 1]]
	else:
		filters["docstatus"] = 1
	return filters


def _draft_schedules_on_date(route_name, departure_date):
	if not user_has_portal_access():
		return 0
	return frappe.db.count(
		"Flight Schedule",
		{
			"route": route_name,
			"departure_date": _normalize_departure_date(departure_date),
			"status": ["in", ["Scheduled", "Delayed"]],
			"docstatus": 0,
		},
	)


def _count_available_seats(schedule_name, boarding_airport=None, deboarding_airport=None):
	from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
		count_seats_available_for_journey,
		schedule_is_multi_segment,
	)

	if schedule_is_multi_segment(schedule_name) and boarding_airport and deboarding_airport:
		return count_seats_available_for_journey(schedule_name, boarding_airport, deboarding_airport)

	return frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule_name, "status": "Available"},
	)


def _count_total_seats(schedule_name):
	return frappe.db.count("Seat Inventory", {"flight_schedule": schedule_name})


def _prepare_schedule_for_search(schedule_name):
	"""Backfill incomplete inventory and release expired holds before search."""
	try:
		doc = frappe.get_doc("Flight Schedule", schedule_name, ignore_permissions=True)
		doc.generate_seat_inventory(raise_on_error=False)
		doc.release_expired_seats()
	except Exception:
		frappe.log_error(
			title="Public flight search seat preparation",
			message=frappe.get_traceback(),
		)


def _search_error_for_route(routes, date, passengers):
	departure_date = _normalize_departure_date(date)
	total_inventory = 0
	total_available = 0
	total_expected = 0

	for route in routes:
		route_name = _row_val(route, "name")
		schedules = _public_get_all(
			"Flight Schedule",
			filters=_bookable_schedule_filters(route_name, departure_date),
			fields=["name"],
		)
		for sched in schedules:
			schedule_name = _row_val(sched, "name")
			_prepare_schedule_for_search(schedule_name)
			total_inventory += _count_total_seats(schedule_name)
			total_available += _count_available_seats(schedule_name)
			try:
				doc = frappe.get_doc("Flight Schedule", schedule_name, ignore_permissions=True)
				total_expected += doc._expected_seat_count()
			except Exception:
				pass

	if total_inventory == 0:
		return (
			"Flights are scheduled on this date but seat inventory has not been generated yet. "
			"Open the flight schedule in Desk, confirm an airplane is linked, and save to generate seats."
		)
	if total_expected and total_inventory < total_expected:
		return (
			f"Flights are scheduled but seat inventory is incomplete ({total_inventory} of about "
			f"{total_expected} seats). Staff should open the flight schedule in Desk and save it to "
			f"regenerate missing seats."
		)
	if total_available == 0:
		return (
			"Flights are scheduled on this date but all seats are currently held or booked. "
			"Cancel unused bookings or wait for expired holds to release."
		)
	if total_available < int(passengers):
		return (
			f"Flights are scheduled but only {total_available} seat(s) are available for "
			f"{passengers} passenger(s). Try fewer passengers or another date."
		)
	return (
		"Flights are scheduled on this date but no seats are available to book. "
		"Staff should open the flight schedule in Desk and ensure seat inventory is complete."
	)


def _count_schedules_on_date(route_name, departure_date):
	return frappe.db.count(
		"Flight Schedule",
		_bookable_schedule_filters(route_name, departure_date),
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
			"is_active": 1,
		},
		order_by="days_before_departure asc",
		limit=1,
	)
	if not fare_rule:
		return 1.0
		rule = frappe.get_doc("Fare Rule", _row_val(fare_rule[0], "name"), ignore_permissions=True)
	return 1 + (rule.price_increase_percentage / 100)


def _prices_for_schedule(schedule, route, route_name):
	payload = prices_for_schedule_search(schedule, route)
	return payload["prices"]


def _min_fare_from_flight_results(results):
	"""Lowest adult cabin price across all flights in search results."""
	from frappe.utils import flt

	min_price = None
	for item in results or []:
		for price in (item.get("prices") or {}).values():
			p = flt(price)
			if p <= 0:
				continue
			if min_price is None or p < min_price:
				min_price = p
	return round(min_price, 2) if min_price is not None else None


def _airplane_details(airplane_link):
	if not airplane_link:
		return {"aircraft_model": None, "operator": None}
	row = frappe.db.get_value(
		"Airplane",
		airplane_link,
		["aircraft_model", "airline"],
		as_dict=True,
	)
	if not row:
		return {"aircraft_model": None, "operator": None}
	operator = None
	if row.airline:
		if frappe.db.exists("Airline", row.airline):
			operator = (
				frappe.db.get_value("Airline", row.airline, "airline_name") or row.airline
			)
		else:
			operator = row.airline
	return {"aircraft_model": row.aircraft_model, "operator": operator}


def _public_seat_class_rows():
	from frappe.utils import cint, flt
	from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import (
		get_default_baggage_policy,
	)
	from bilan_sky.bilan_air_booking_system.utils.seat_class_utils import list_bookable_fare_classes

	defaults = get_default_baggage_policy()
	rows = list_bookable_fare_classes()
	result = []
	for row in rows:
		checked_kg = flt(row.get("checked_baggage_kg")) or defaults["checked_kg"]
		carry_on_kg = flt(row.get("carry_on_kg")) or defaults["carry_on_kg"]
		checked_pieces = cint(row.get("checked_baggage_pieces")) or defaults["checked_pieces"]
		result.append(
			{
				"name": row["name"],
				"class_name": row["class_name"],
				"cabin_class": row.get("cabin_class"),
				"cabin_name": row.get("cabin_name"),
				"use_on_aircraft_layout": cint(row.get("use_on_aircraft_layout")),
				"price_multiplier": row.get("price_multiplier"),
				"color_code": row.get("color_code"),
				"checked_baggage_kg": checked_kg,
				"checked_baggage_pieces": checked_pieces,
				"carry_on_kg": carry_on_kg,
				"description": row.get("description"),
			}
		)
	return result


def _public_cabin_class_rows():
	from bilan_sky.bilan_air_booking_system.utils.seat_class_utils import list_public_cabin_classes

	return list_public_cabin_classes()


def _schedule_to_flight_result(schedule, route, route_name, passengers, origin_airport=None, destination_airport=None):
	from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
		get_schedule_segments,
		schedule_is_multi_segment,
	)

	schedule_name = _row_val(schedule, "name")
	board = origin_airport
	deboard = destination_airport
	if schedule_is_multi_segment(schedule_name):
		segments = get_schedule_segments(schedule_name)
		if segments and not board:
			board = segments[0]["origin_airport"]
		if segments and not deboard:
			deboard = segments[-1]["destination_airport"]

	available = _count_available_seats(schedule_name, board, deboard)
	if available < int(passengers):
		return None

	released = frappe.db.count(
		"Seat Inventory",
		{"flight_schedule": schedule_name, "status": ["!=", "Unreleased"]},
	)
	total_capacity = frappe.db.get_value("Flight Schedule", schedule_name, "total_aircraft_capacity") or 0
	seats_released = frappe.db.get_value("Flight Schedule", schedule_name, "seats_released_count") or 0

	plane = _airplane_details(_row_val(schedule, "airplane"))
	is_multi = schedule_is_multi_segment(schedule_name)
	segments = get_schedule_segments(schedule_name) if is_multi else []
	stop_count = max(len(segments) - 1, 0) if is_multi else 0
	from frappe.utils import cint

	return {
		"flight_number": _row_val(schedule, "flight_number"),
		"schedule_id": schedule_name,
		"departure_date": str(_row_val(schedule, "departure_date")),
		"arrival_date": str(
			_row_val(schedule, "arrival_date") or _row_val(schedule, "departure_date")
		),
		"departure_time": _row_val(schedule, "departure_time"),
		"arrival_time": _row_val(schedule, "arrival_time"),
		"available_seats": available,
		"seats_released": seats_released,
		"total_aircraft_capacity": total_capacity,
		"is_multi_segment": is_multi,
		"stop_count": stop_count,
		"segments": segments,
		"prices": _prices_for_schedule(schedule, route, route_name),
		"base_fares": prices_for_schedule_search(schedule, route)["base_fares"],
		"route": route_name,
		"boarding_airport": board,
		"deboarding_airport": deboard,
		"aircraft_model": plane.get("aircraft_model"),
		"operator": plane.get("operator"),
		"is_active": cint(_row_val(schedule, "is_active", 1)),
		"only_prepayment": cint(_row_val(schedule, "only_prepayment", 0)),
	}


def _find_schedules_for_routes(routes, date, passengers, origin_airport=None, destination_airport=None):
	"""Schedules belong to a Flight Route; route defines origin/destination airports."""
	results = []
	for route in routes:
		route_name = _row_val(route, "name")
		departure_date = _normalize_departure_date(date)
		board = origin_airport or _row_val(route, "origin_airport")
		deboard = destination_airport or _row_val(route, "destination_airport")
		schedules = _public_get_all(
			"Flight Schedule",
			filters=_bookable_schedule_filters(route_name, departure_date),
			fields=[
				"name",
				"flight_number",
				"departure_date",
				"departure_time",
				"arrival_date",
				"arrival_time",
				"base_fare_adult_override",
				"base_fare_child_override",
				"base_fare_infant_override",
				"airplane",
			],
		)
		for schedule in schedules:
			item = _schedule_to_flight_result(
				schedule, route, route_name, passengers, board, deboard
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

	origin_airport = None
	destination_airport = None

	if route:
		if not frappe.db.exists("Flight Route", route):
			return {"error": "Route not found", "flights": []}
		route_doc = frappe.get_doc("Flight Route", route, ignore_permissions=True)
		if not route_doc.is_active:
			return {"error": "This route is not active", "flights": []}
		from bilan_sky.bilan_air_booking_system.utils.fare_pricing import route_fares_for_api

		routes = [
			{
				"name": route_doc.name,
				**route_fares_for_api(route_doc),
				"origin_airport": route_doc.origin_airport,
				"destination_airport": route_doc.destination_airport,
			}
		]
		origin_airport = route_doc.origin_airport
		destination_airport = route_doc.destination_airport
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
			filters={"is_active": 1},
			fields=[
				"name",
				"base_fare_adult",
				"base_fare_child",
				"base_fare_infant",
				"base_fare",
				"origin_airport",
				"destination_airport",
				"is_multi_segment",
			],
		)
		from bilan_sky.bilan_air_booking_system.utils.flight_segments import route_serves_journey

		routes = [
			r
			for r in routes
			if route_serves_journey(r.name, origin_airport, destination_airport)
			or (
				not r.is_multi_segment
				and r.origin_airport == origin_airport
				and r.destination_airport == destination_airport
			)
		]

		if not routes:
			return {
				"error": "No active route for these airports. Check From/To or pick a route.",
				"flights": [],
			}

	results = _find_schedules_for_routes(
		routes, date, passengers, origin_airport, destination_airport
	)

	if not results:
		scheduled_count = sum(
			_count_schedules_on_date(_row_val(r, "name"), date) for r in routes
		)
		if scheduled_count > 0:
			departure_date = _normalize_departure_date(date)
			for route in routes:
				route_name = _row_val(route, "name")
				schedules = _public_get_all(
					"Flight Schedule",
					filters=_bookable_schedule_filters(route_name, departure_date),
					fields=["name"],
				)
				for sched in schedules:
					_prepare_schedule_for_search(_row_val(sched, "name"))
			origin_airport = resolve_airport_name(origin) if origin else None
			destination_airport = resolve_airport_name(destination) if destination else None
			results = _find_schedules_for_routes(
				routes, date, passengers, origin_airport, destination_airport
			)

	if not results:
		scheduled_count = sum(
			_count_schedules_on_date(_row_val(r, "name"), date) for r in routes
		)
		if scheduled_count > 0:
			error = _search_error_for_route(routes, date, passengers)
		else:
			draft_count = sum(
				_draft_schedules_on_date(_row_val(r, "name"), date) for r in routes
			)
			if draft_count > 0:
				error = (
					f"{draft_count} flight(s) exist on this date but are still draft. "
					"Open each Flight Schedule in Desk and click Submit, or sign in as portal staff to book drafts."
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
	from frappe.utils import cint

	if not schedule_id or not frappe.db.exists("Flight Schedule", schedule_id):
		return {"error": "Flight schedule not found"}

	schedule = frappe.get_doc("Flight Schedule", schedule_id, ignore_permissions=True)
	if not cint(schedule.is_active):
		return {"error": "This flight is not open for booking."}
	if schedule.status not in ("Scheduled", "Delayed"):
		return {
			"error": f"Cannot book: flight status is {schedule.status}",
		}

	route = frappe.get_doc("Flight Route", schedule.route, ignore_permissions=True)
	flight = _schedule_to_flight_result(
		schedule, route, route.name, int(passengers or 1)
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
def list_public_seat_classes():
	"""Active fare classes with baggage allowance for public fare cards."""
	return {"seat_classes": _public_seat_class_rows()}


@frappe.whitelist(allow_guest=True)
def list_public_cabin_classes():
	"""Active cabin types for search filters and seat maps."""
	return {"cabin_classes": _public_cabin_class_rows()}


@frappe.whitelist(allow_guest=True)
def fetch_all_available_routes():
	"""Get all available routes with airport details"""

	routes = _public_get_all(
		"Flight Route",
		filters={"is_active": 1},
		fields=[
			"name",
			"route_name",
			"origin_airport",
			"destination_airport",
			"base_fare_adult",
			"base_fare_child",
			"base_fare_infant",
			"base_fare",
		],
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
	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import is_seat_selection_enabled

	enable_seat_selection = is_seat_selection_enabled()
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
			"enable_seat_selection": enable_seat_selection,
		}

	route = routes[0]
	origin_iata = get_airport_iata(route.origin_airport) or ""
	destination_iata = get_airport_iata(route.destination_airport) or ""

	upcoming_filters = {
		"route": route.name,
		"departure_date": [">=", nowdate()],
		"status": ["in", ["Scheduled", "Delayed"]],
	}
	if user_has_portal_access():
		upcoming_filters["docstatus"] = ["in", [0, 1]]
	else:
		upcoming_filters["docstatus"] = 1
	upcoming = _public_get_all(
		"Flight Schedule",
		filters=upcoming_filters,
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
		"enable_seat_selection": enable_seat_selection,
	}


def _resolve_routes_for_browse(route=None, origin=None, destination=None):
	"""Active routes matching optional route name or origin/destination airports."""
	if route:
		if not frappe.db.exists("Flight Route", route):
			return []
		if not frappe.db.get_value("Flight Route", route, "is_active"):
			return []
		return _public_get_all(
			"Flight Route",
			filters={"name": route, "is_active": 1},
			fields=[
				"name",
				"route_name",
				"origin_airport",
				"destination_airport",
				"base_fare_adult",
				"base_fare_child",
				"base_fare_infant",
				"base_fare",
				"is_multi_segment",
			],
		)

	origin_airport = resolve_airport_name(origin) if origin else None
	destination_airport = resolve_airport_name(destination) if destination else None

	if origin or destination:
		route_filters = {"is_active": 1}
		if origin_airport:
			route_filters["origin_airport"] = origin_airport
		if destination_airport:
			route_filters["destination_airport"] = destination_airport
		routes = _public_get_all(
			"Flight Route",
			filters=route_filters,
			fields=[
				"name",
				"route_name",
				"origin_airport",
				"destination_airport",
				"base_fare_adult",
				"base_fare_child",
				"base_fare_infant",
				"base_fare",
				"is_multi_segment",
			],
		)
		if not routes:
			return []
		from bilan_sky.bilan_air_booking_system.utils.flight_segments import route_serves_journey

		if origin_airport and destination_airport:
			routes = [
				r
				for r in routes
				if route_serves_journey(r.name, origin_airport, destination_airport)
				or (
					not r.is_multi_segment
					and r.origin_airport == origin_airport
					and r.destination_airport == destination_airport
				)
			]
		return routes

	return _public_get_all(
		"Flight Route",
		filters={"is_active": 1},
		fields=[
			"name",
			"route_name",
			"origin_airport",
			"destination_airport",
			"base_fare_adult",
			"base_fare_child",
			"base_fare_infant",
			"base_fare",
			"is_multi_segment",
		],
	)


def _schedule_to_browse_row(schedule, route_row, passengers=1):
	schedule_name = _row_val(schedule, "name")
	route_name = _row_val(route_row, "name")
	_prepare_schedule_for_search(schedule_name)

	from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
		get_schedule_segments,
		schedule_is_multi_segment,
	)

	board = _row_val(route_row, "origin_airport")
	deboard = _row_val(route_row, "destination_airport")
	if schedule_is_multi_segment(schedule_name):
		segments = get_schedule_segments(schedule_name)
		if segments:
			board = segments[0]["origin_airport"]
			deboard = segments[-1]["destination_airport"]

	available = _count_available_seats(schedule_name, board, deboard)
	status = _row_val(schedule, "status") or "Scheduled"
	bookable = status in ("Scheduled", "Delayed") and available >= int(passengers or 1)
	prices = _prices_for_schedule(schedule, route_row, route_name)

	return {
		"schedule_id": schedule_name,
		"flight_number": _row_val(schedule, "flight_number"),
		"route": route_name,
		"route_name": _row_val(route_row, "route_name") or route_name,
		"origin": board,
		"destination": deboard,
		"origin_code": get_airport_iata(board) or board,
		"destination_code": get_airport_iata(deboard) or deboard,
		"origin_label": airport_display_label(board),
		"destination_label": airport_display_label(deboard),
		"departure_date": str(_row_val(schedule, "departure_date")),
		"departure_time": _row_val(schedule, "departure_time"),
		"arrival_date": str(_row_val(schedule, "arrival_date") or _row_val(schedule, "departure_date")),
		"arrival_time": _row_val(schedule, "arrival_time"),
		"status": status,
		"airplane": _row_val(schedule, "airplane") or "",
		"available_seats": available,
		"prices": prices,
		"bookable": bookable,
	}


@frappe.whitelist(allow_guest=True)
def list_public_schedules(
	date=None,
	date_from=None,
	date_to=None,
	origin=None,
	destination=None,
	route=None,
	flight_number=None,
	status=None,
	passengers=1,
	bookable_only=0,
	limit=150,
):
	"""Public timetable browse: upcoming schedules with optional filters."""
	passengers = int(passengers or 1)
	bookable_only = int(bookable_only or 0)
	limit = min(int(limit or 150), 300)

	if date:
		start_date = _normalize_departure_date(date)
		end_date = start_date
	elif date_from or date_to:
		start_date = _normalize_departure_date(date_from or nowdate())
		end_date = _normalize_departure_date(date_to or add_days(start_date, 30))
	else:
		start_date = _normalize_departure_date(nowdate())
		end_date = add_days(start_date, 30)

	if end_date < start_date:
		start_date, end_date = end_date, start_date

	routes = _resolve_routes_for_browse(route=route, origin=origin, destination=destination)
	if not routes:
		return {
			"flights": [],
			"date_from": str(start_date),
			"date_to": str(end_date),
			"count": 0,
		}

	route_names = [_row_val(r, "name") for r in routes]
	schedule_filters = {
		"route": ["in", route_names],
		"departure_date": ["between", [start_date, end_date]],
		"docstatus": 1,
	}

	flight_number = (flight_number or "").strip()
	if flight_number:
		schedule_filters["flight_number"] = ["like", f"%{flight_number}%"]

	status = (status or "").strip()
	if status:
		schedule_filters["status"] = status
	elif bookable_only:
		schedule_filters["status"] = ["in", ["Scheduled", "Delayed"]]

	schedules = _public_get_all(
		"Flight Schedule",
		filters=schedule_filters,
		fields=[
			"name",
			"flight_number",
			"route",
			"airplane",
			"departure_date",
			"departure_time",
			"arrival_date",
			"arrival_time",
			"status",
			"base_fare_adult_override",
			"base_fare_child_override",
			"base_fare_infant_override",
		],
		order_by="departure_date asc, departure_time asc",
		limit=limit,
	)

	route_by_name = {_row_val(r, "name"): r for r in routes}
	flights = []
	for schedule in schedules:
		route_name = _row_val(schedule, "route")
		route_row = route_by_name.get(route_name)
		if not route_row:
			continue
		row = _schedule_to_browse_row(schedule, route_row, passengers)
		if bookable_only and not row["bookable"]:
			continue
		flights.append(row)

	return {
		"flights": flights,
		"date_from": str(start_date),
		"date_to": str(end_date),
		"count": len(flights),
	}


@frappe.whitelist(allow_guest=True)
def suggest_nearest_flight_dates(
	origin=None,
	destination=None,
	anchor_date=None,
	min_date=None,
	passengers=1,
	max_suggestions=3,
	search_days=60,
):
	"""Nearest dates with bookable flights for a route, sorted by closeness to anchor_date."""
	if not anchor_date or not origin or not destination:
		return {"suggestions": [], "anchor_date": anchor_date}

	passengers = int(passengers or 1)
	max_suggestions = min(int(max_suggestions or 3), 5)
	search_days = min(int(search_days or 60), 90)

	anchor = _normalize_departure_date(anchor_date)
	earliest = _normalize_departure_date(min_date) if min_date else add_days(anchor, -search_days)
	latest = add_days(anchor, search_days)
	if earliest > anchor:
		earliest = anchor

	origin_airport = resolve_airport_name(origin)
	destination_airport = resolve_airport_name(destination)
	if not origin_airport or not destination_airport:
		return {"suggestions": [], "anchor_date": str(anchor)}

	routes = _resolve_routes_for_browse(origin=origin, destination=destination)
	if not routes:
		return {"suggestions": [], "anchor_date": str(anchor)}

	route_names = [_row_val(r, "name") for r in routes]
	candidate_dates = _public_get_all(
		"Flight Schedule",
		filters={
			"route": ["in", route_names],
			"departure_date": ["between", [earliest, latest]],
			"docstatus": 1,
			"status": ["in", ["Scheduled", "Delayed"]],
		},
		pluck="departure_date",
		distinct=True,
	)

	unique_dates = sorted(
		{_normalize_departure_date(d) for d in candidate_dates if _normalize_departure_date(d) != anchor},
		key=lambda d: (abs(frappe.utils.date_diff(d, anchor)), 0 if frappe.utils.date_diff(d, anchor) >= 0 else 1),
	)

	suggestions = []
	for candidate in unique_dates:
		results = _find_schedules_for_routes(
			routes,
			candidate,
			passengers,
			origin_airport,
			destination_airport,
		)
		if not results:
			continue
		day_offset = frappe.utils.date_diff(candidate, anchor)
		suggestions.append(
			{
				"date": str(candidate),
				"flight_count": len(results),
				"days_from_anchor": day_offset,
				"min_fare": _min_fare_from_flight_results(results),
			}
		)
		if len(suggestions) >= max_suggestions:
			break

	return {"suggestions": suggestions, "anchor_date": str(anchor)}
