# bilan_air/api/flight_route.py

import frappe

from bilan_sky.bilan_air_booking_system.utils.airports import enrich_route_airport_labels


@frappe.whitelist(allow_guest=True)
def fetch_all_routes():
    """Get all flight routes"""
    routes = frappe.get_all(
        "Flight Route",
        filters={"is_active": 1},
        fields=[
            "name",
            "route_name",
            "origin_airport",
            "destination_airport",
            "distance_km",
            "base_fare",
            "is_active",
        ],
    )
    for route in routes:
        enrich_route_airport_labels(route)
    return routes

@frappe.whitelist(allow_guest=True)
def find_routes(origin, destination):
    """Search routes by origin and destination"""
    return frappe.get_all("Flight Route",
        filters={
            "origin_airport": origin,
            "destination_airport": destination,
            "is_active": 1
        },
        fields=["name", "route_name", "base_fare", "distance_km"]
    )