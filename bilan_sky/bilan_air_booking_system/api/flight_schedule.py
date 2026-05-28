# bilan_air/api/flight_schedule.py

import frappe
from frappe.utils import nowdate

from bilan_sky.bilan_air_booking_system.utils.airports import resolve_airport_name

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
                base_fare = schedule.base_fare_override or route.base_fare
                
                from frappe.utils import date_diff
                days_before = date_diff(schedule.departure_date, nowdate())
                
                fare_rule = frappe.get_all(
                    "Fare Rule",
                    filters={
                        "route": route.name,
                        "days_before_departure": [">=", days_before],
                    },
                    order_by="days_before_departure asc",
                    limit=1,
                    ignore_permissions=True,
                )
                
                price_multiplier = 1.0
                if fare_rule:
                    rule = frappe.get_doc("Fare Rule", fare_rule[0].name)
                    price_multiplier = 1 + (rule.price_increase_percentage / 100)
                
                economy_price = base_fare * price_multiplier
                
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
        "origin": route.origin_airport,
        "destination": route.destination_airport,
        "departure_date": schedule.departure_date,
        "departure_time": schedule.departure_time,
        "arrival_date": schedule.arrival_date,
        "arrival_time": schedule.arrival_time,
        "aircraft": airplane.registration_number,
        "aircraft_model": airplane.aircraft_model
    }