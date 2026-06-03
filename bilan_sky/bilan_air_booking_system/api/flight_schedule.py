# bilan_air/api/flight_schedule.py

import frappe
from frappe.utils import nowdate

from bilan_sky.bilan_air_booking_system.utils.airports import (
    airport_display_label,
    get_airport_iata,
    resolve_airport_name,
)

@frappe.whitelist(allow_guest=True)
def search_available_flights(origin, destination, date, passengers=1):
    """
    Search for available flights
    
    Args:
        origin: Origin airport IATA code
        destination: Destination airport IATA code
        date: Departure date (YYYY-MM-DD)
        passengers: Number of passengers
    """
    
    origin_airport = resolve_airport_name(origin)
    destination_airport = resolve_airport_name(destination)
    if not origin_airport or not destination_airport:
        return []

    routes = frappe.get_all(
        "Flight Route",
        filters={
            "origin_airport": origin_airport,
            "destination_airport": destination_airport,
            "is_active": 1,
        },
        fields=["name", "base_fare"],
        ignore_permissions=True,
    )
    
    if not routes:
        return []
    
    flights = []
    
    for route in routes:
        schedules = frappe.get_all(
            "Flight Schedule",
            filters={
                "route": route.name,
                "departure_date": date,
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
                "airplane",
                "base_fares_override",
                "base_fare_override",
            ],
            ignore_permissions=True,
        )
        
        for schedule in schedules:
            available = frappe.db.count("Seat Inventory", {
                "flight_schedule": schedule.name,
                "status": "Available"
            })
            
            if available >= int(passengers):
                from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
                    economy_price_for_passenger,
                )

                economy_price = economy_price_for_passenger(schedule, route, "Adult")
                
                flights.append({
                    "schedule_id": schedule.name,
                    "flight_number": schedule.flight_number,
                    "departure_date": schedule.departure_date,
                    "departure_time": schedule.departure_time,
                    "arrival_date": schedule.arrival_date,
                    "arrival_time": schedule.arrival_time,
                    "available_seats": available,
                    "price_per_adult": round(economy_price, 2)
                })
    
    return flights

@frappe.whitelist(allow_guest=True)
def fetch_seat_map(flight_schedule_name):
    """Get seat map for a flight"""
    
    seats = frappe.get_all(
        "Seat Inventory",
        filters={"flight_schedule": flight_schedule_name},
        fields=["name", "seat_number", "seat_class", "status", "booking_reference"],
        ignore_permissions=True,
    )
    
    seat_map = {
        "First Class": [],
        "Business": [],
        "Economy": []
    }
    
    for seat in seats:
        seat_class_doc = frappe.get_doc("Seat Class", seat.seat_class, ignore_permissions=True)
        class_name = seat_class_doc.class_name
        
        seat_map[class_name].append({
            "name": seat.name,
            "seat_number": seat.seat_number,
            "status": seat.status,
            "booked_by": seat.booking_reference if seat.status == "Booked" else None
        })
    
    return seat_map

@frappe.whitelist(allow_guest=True)
def fetch_flight_details(schedule_id):
    """Get detailed flight information"""
    
    schedule = frappe.get_doc("Flight Schedule", schedule_id, ignore_permissions=True)
    route = frappe.get_doc("Flight Route", schedule.route, ignore_permissions=True)
    airplane = frappe.get_doc("Airplane", schedule.airplane, ignore_permissions=True)
    
    return {
        "flight_number": schedule.flight_number,
        "origin": airport_display_label(route.origin_airport),
        "destination": airport_display_label(route.destination_airport),
        "departure_date": schedule.departure_date,
        "departure_time": schedule.departure_time,
        "arrival_date": schedule.arrival_date,
        "arrival_time": schedule.arrival_time,
        "aircraft": airplane.registration_number,
        "aircraft_model": airplane.aircraft_model
    }


def _schedule_status_row(schedule, route_cache=None):
    route_cache = route_cache or {}
    route_name = schedule.route if isinstance(schedule, dict) else schedule.get("route")
    if route_name not in route_cache:
        route = frappe.get_doc("Flight Route", route_name, ignore_permissions=True)
        route_cache[route_name] = route

    route = route_cache[route_name]
    origin_iata = get_airport_iata(route.origin_airport) or route.origin_airport
    dest_iata = get_airport_iata(route.destination_airport) or route.destination_airport

    if isinstance(schedule, dict):
        row = schedule
    else:
        row = schedule.as_dict()

    return {
        "schedule_id": row.name,
        "flight_number": row.flight_number,
        "route": route_name,
        "origin": route.origin_airport,
        "destination": route.destination_airport,
        "origin_code": origin_iata,
        "destination_code": dest_iata,
        "origin_label": airport_display_label(route.origin_airport),
        "destination_label": airport_display_label(route.destination_airport),
        "departure_date": str(row.departure_date),
        "departure_time": row.departure_time,
        "arrival_date": str(row.arrival_date),
        "arrival_time": row.arrival_time,
        "status": row.status,
        "terminal_gate": "TBC",
        "airplane": row.airplane,
    }


@frappe.whitelist(allow_guest=True)
def list_flight_status(
    date=None,
    flight_number=None,
    origin=None,
    destination=None,
    booking_reference=None,
):
    """Public flight status board for the website."""
    from frappe.utils import getdate, now, nowdate

    search_date = getdate(date) if date else nowdate()
    filters = {
        "departure_date": search_date,
        "docstatus": 1,
    }

    booking_reference = (booking_reference or "").strip()
    if booking_reference:
        if not frappe.db.exists("Air Booking", booking_reference):
            return {"flights": [], "date": str(search_date), "updated_at": now()}
        schedule_name = frappe.db.get_value("Air Booking", booking_reference, "flight_schedule")
        if not schedule_name:
            return {"flights": [], "date": str(search_date), "updated_at": now()}
        filters["name"] = schedule_name
    else:
        flight_number = (flight_number or "").strip()
        if flight_number:
            filters["flight_number"] = ["like", f"%{flight_number}%"]

        origin_airport = resolve_airport_name(origin) if origin else None
        destination_airport = resolve_airport_name(destination) if destination else None
        if origin or destination:
            route_filters = {"is_active": 1}
            if origin_airport:
                route_filters["origin_airport"] = origin_airport
            if destination_airport:
                route_filters["destination_airport"] = destination_airport
            routes = frappe.get_all(
                "Flight Route",
                filters=route_filters,
                pluck="name",
                ignore_permissions=True,
            )
            if not routes:
                return {"flights": [], "date": str(search_date), "updated_at": now()}
            filters["route"] = ["in", routes]

    schedules = frappe.get_all(
        "Flight Schedule",
        filters=filters,
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
        ],
        order_by="departure_time asc",
        ignore_permissions=True,
    )

    route_cache = {}
    flights = [_schedule_status_row(schedule, route_cache) for schedule in schedules]

    return {
        "flights": flights,
        "date": str(search_date),
        "updated_at": now(),
    }