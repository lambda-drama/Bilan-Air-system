# bilan_air/api/seat_inventory.py

import frappe

@frappe.whitelist(allow_guest=True)
def fetch_available_seats(flight_schedule_name, seat_class=None):
    """Get available seats for a flight"""
    
    filters = {
        "flight_schedule": flight_schedule_name,
        "status": "Available"
    }
    
    if seat_class:
        filters["seat_class"] = seat_class
    
    return frappe.get_all("Seat Inventory",
        filters=filters,
        fields=["name", "seat_number", "seat_class"]
    )

@frappe.whitelist(allow_guest=True)
def calculate_seat_price(seat_name, booking_date=None):
    """Get current price for a seat"""
    
    seat = frappe.get_doc("Seat Inventory", seat_name)
    return seat.get_current_price(booking_date)