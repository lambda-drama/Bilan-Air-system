# bilan_air/api/air_booking.py

import frappe
from frappe.utils import now

@frappe.whitelist(allow_guest=True)
def create_booking(booking_data):
    """
    Create a new booking
    """
    
    passenger_links = []
    
    for pax in booking_data.get("passengers", []):
        existing = frappe.db.exists("Passenger", {"id_number": pax.get("id_number")})
        
        if existing:
            passenger = frappe.get_doc("Passenger", existing)
        else:
            passenger = frappe.get_doc({
                "doctype": "Passenger",
                "full_name": pax.get("full_name"),
                "passenger_type": pax.get("passenger_type", "Adult"),
                "id_number": pax.get("id_number"),
                "date_of_birth": pax.get("date_of_birth"),
                "phone_number": booking_data.get("payer_phone"),
                "email": booking_data.get("payer_email")
            })
            passenger.insert()
        
        passenger_links.append({
            "passenger": passenger.name,
            "seat_number": pax.get("seat_number"),
            "fare_paid": 0
        })
    
    booking = frappe.get_doc({
        "doctype": "Air Booking",
        "flight_schedule": booking_data.get("flight_schedule"),
        "payer_name": booking_data.get("payer_name"),
        "payer_email": booking_data.get("payer_email"),
        "payer_phone": booking_data.get("payer_phone"),
        "passengers": passenger_links,
        "booking_status": "Reserved",
        "payment_status": "Pending",
        "booking_date": now()
    })
    
    booking.insert()
    booking.calculate_total_fare()
    booking.save()
    frappe.db.commit()
    
    for passenger in booking.passengers:
        seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
        seat.reserve(booking.name)
    
    return {
        "pnr": booking.name,
        "status": booking.booking_status,
        "total_fare": booking.total_fare
    }

@frappe.whitelist(allow_guest=True)
def process_payment(pnr, payment_method, transaction_id=None):
    """Confirm payment for a booking"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    
    if booking.payment_status == "Paid":
        return {"error": "Booking already paid"}
    
    booking.payment_status = "Paid"
    booking.payment_method = payment_method
    booking.confirm_booking()
    booking.save()
    frappe.db.commit()
    
    return {
        "success": True,
        "pnr": booking.name,
        "total": booking.total_fare
    }

@frappe.whitelist(allow_guest=True)
def fetch_booking_details(pnr):
    """Get booking by PNR"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    
    passengers = []
    for pax in booking.passengers:
        passenger = frappe.get_doc("Passenger", pax.passenger)
        passengers.append({
            "name": passenger.full_name,
            "type": passenger.passenger_type,
            "seat": pax.seat_number,
            "ticket_number": pax.ticket_number,
            "check_in_status": pax.check_in_status
        })
    
    flight = frappe.get_doc("Flight Schedule", booking.flight_schedule)
    route = frappe.get_doc("Flight Route", flight.route)
    
    return {
        "pnr": booking.name,
        "status": booking.booking_status,
        "payment_status": booking.payment_status,
        "total_fare": booking.total_fare,
        "passengers": passengers,
        "flight": {
            "flight_number": flight.flight_number,
            "origin": route.origin_airport,
            "destination": route.destination_airport,
            "departure_date": flight.departure_date,
            "departure_time": flight.departure_time
        }
    }

@frappe.whitelist(allow_guest=True)
def cancel_booking(pnr):
    """Cancel a booking"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    booking.cancel_booking()
    
    return {"success": True, "pnr": booking.name, "status": "Cancelled"}

@frappe.whitelist()
def process_check_in(pnr, passenger_index):
    """Check in a passenger"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    result = booking.check_in_passenger(int(passenger_index))
    
    return result

@frappe.whitelist()
def mark_boarded(pnr, passenger_index):
    """Mark passenger as boarded"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    result = booking.board_passenger(int(passenger_index))
    
    return result