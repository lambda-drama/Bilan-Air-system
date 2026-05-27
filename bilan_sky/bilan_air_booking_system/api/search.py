# bilan_air/api/search.py

import frappe
from frappe.utils import add_days, nowdate

from bilan_sky.bilan_air_booking_system.utils.airports import resolve_airport_name

@frappe.whitelist(allow_guest=True)
def find_flights(origin, destination, date, passengers=1):
    """
    Main search endpoint for front-end
    """
    origin_airport = resolve_airport_name(origin)
    destination_airport = resolve_airport_name(destination)

    if not origin_airport or not destination_airport:
        return {"error": "Unknown origin or destination airport", "flights": []}

    routes = frappe.get_all("Flight Route",
        filters={
            "origin_airport": origin_airport,
            "destination_airport": destination_airport,
            "is_active": 1
        },
        fields=["name", "base_fare"]
    )
    
    if not routes:
        return {"error": "No flights found for this route on the selected date", "flights": []}
    
    results = []
    
    for route in routes:
        schedules = frappe.get_all("Flight Schedule",
            filters={
                "route": route.name,
                "departure_date": date,
                "status": ["in", ["Scheduled", "Delayed"]],
            },
            fields=["name", "flight_number", "departure_date", "departure_time",
                    "arrival_date", "arrival_time", "base_fare_override", "airplane"]
        )
        
        for schedule in schedules:
            available = frappe.db.count("Seat Inventory", {
                "flight_schedule": schedule.name,
                "status": "Available"
            })
            
            if available >= int(passengers):
                seat_classes = frappe.get_all("Seat Class",
                    fields=["name", "class_name", "price_multiplier"]
                )
                
                base_fare = schedule.base_fare_override or route.base_fare
                
                days_before = frappe.utils.date_diff(schedule.departure_date, nowdate())
                
                fare_rule = frappe.get_all("Fare Rule",
                    filters={
                        "route": route.name,
                        "days_before_departure": [">=", days_before]
                    },
                    order_by="days_before_departure asc",
                    limit=1
                )
                
                multiplier = 1.0
                if fare_rule:
                    rule = frappe.get_doc("Fare Rule", fare_rule[0].name)
                    multiplier = 1 + (rule.price_increase_percentage / 100)
                
                prices = {}
                for seat_class in seat_classes:
                    prices[seat_class.class_name] = round(base_fare * seat_class.price_multiplier * multiplier, 2)
                
                results.append({
                    "flight_number": schedule.flight_number,
                    "schedule_id": schedule.name,
                    "departure_time": schedule.departure_time,
                    "arrival_time": schedule.arrival_time,
                    "available_seats": available,
                    "prices": prices
                })
    
    return {
        "origin": origin,
        "destination": destination,
        "date": date,
        "passengers": passengers,
        "flights": results
    }

@frappe.whitelist(allow_guest=True)
def fetch_all_available_routes():
    """Get all available routes with airport details"""
    
    routes = frappe.get_all("Flight Route",
        filters={"is_active": 1},
        fields=["name", "route_name", "origin_airport", "destination_airport", "base_fare"]
    )
    
    for route in routes:
        origin = frappe.get_doc("Airport", route.origin_airport)
        destination = frappe.get_doc("Airport", route.destination_airport)
        
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
	routes = frappe.get_all(
		"Flight Route",
		filters={"is_active": 1},
		fields=["name", "origin_airport", "destination_airport"],
		order_by="modified desc",
		limit=1,
	)
	if not routes:
		return {
			"origin_iata": "NBO",
			"destination_iata": "MGQ",
			"suggested_date": add_days(nowdate(), 1),
		}

	route = routes[0]
	from bilan_sky.bilan_air_booking_system.utils.airports import get_airport_iata

	origin_iata = get_airport_iata(route.origin_airport) or "NBO"
	destination_iata = get_airport_iata(route.destination_airport) or "MGQ"

	upcoming = frappe.get_all(
		"Flight Schedule",
		filters={
			"route": route.name,
			"departure_date": [">=", nowdate()],
			"status": ["in", ["Scheduled", "Delayed"]],
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
	}