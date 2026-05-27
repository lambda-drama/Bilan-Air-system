# bilan_air/utils/tasks.py
# Scheduled tasks for Bilan Air booking system

import frappe
from frappe.utils import now, add_to_date, get_datetime, nowdate

# =========================================================
# TASK 1: RELEASE EXPIRED SEATS
# =========================================================

@frappe.whitelist()
def release_expired_seats():
    """Release all expired seat reservations. Runs every minute."""
    
    expired_seats = frappe.get_all(
        "Seat Inventory",
        filters={
            "status": ["in", ["Hold", "Reserved"]],
            "hold_expiry": ["<", now()]
        },
        fields=["name", "seat_number", "flight_schedule", "booking_reference"]
    )
    
    if not expired_seats:
        return {"success": True, "message": "No expired seats", "released_count": 0}
    
    released_count = 0
    
    for seat_data in expired_seats:
        try:
            seat = frappe.get_doc("Seat Inventory", seat_data.name)
            
            if seat.status in ("Hold", "Reserved") and seat.hold_expiry and get_datetime(seat.hold_expiry) < get_datetime(now()):
                
                # Cancel the associated booking if still reserved
                if seat.booking_reference:
                    booking = frappe.get_doc("Air Booking", seat.booking_reference)
                    if booking.booking_status == "Reserved":
                        booking.booking_status = "Cancelled"
                        booking.save()
                
                # Release the seat
                seat.status = "Available"
                seat.hold_expiry = None
                seat.booking_reference = None
                seat.save()
                frappe.db.commit()
                released_count += 1
                
        except Exception as e:
            frappe.log_error(f"Seat release error for {seat_data.name}: {str(e)}")
    
    if released_count > 0:
        frappe.log_error(f"Released {released_count} expired seats")
    
    return {"success": True, "released_count": released_count}


# =========================================================
# TASK 2: SEND FLIGHT REMINDERS
# =========================================================

@frappe.whitelist()
def send_flight_reminders():
    """Send reminders for flights departing tomorrow. Runs daily at 8 AM."""
    
    tomorrow = add_to_date(nowdate(), days=1)
    
    flights = frappe.get_all(
        "Flight Schedule",
        filters={"departure_date": tomorrow, "status": "Scheduled"},
        fields=["name", "flight_number", "departure_date", "departure_time", "route"]
    )
    
    reminders_sent = 0
    
    for flight in flights:
        bookings = frappe.get_all(
            "Air Booking",
            filters={"flight_schedule": flight.name, "booking_status": "Paid"},
            fields=["name", "payer_name", "payer_email"]
        )
        
        for booking in bookings:
            send_reminder_email(booking, flight)
            reminders_sent += 1
    
    return {"success": True, "reminders_sent": reminders_sent}


def send_reminder_email(booking, flight):
    """Helper to send email reminder"""
    
    from frappe.core.doctype.communication.email import make
    
    subject = f"Reminder: Bilan Air flight {flight.flight_number} tomorrow"
    message = f"""
    Dear {booking.payer_name},
    
    Reminder for your flight tomorrow:
    
    Flight: {flight.flight_number}
    Route: {flight.route}
    Date: {flight.departure_date}
    Time: {flight.departure_time}
    PNR: {booking.name}
    
    Please arrive 2 hours before departure.
    
    Thank you for choosing Bilan Air.
    """
    
    make(
        subject=subject,
        content=message,
        recipients=[booking.payer_email],
        send_email=True,
        doctype="Air Booking",
        docname=booking.name
    )


# =========================================================
# TASK 3: UPDATE FLIGHT STATUSES
# =========================================================

@frappe.whitelist()
def update_flight_statuses():
    """Auto-update flight statuses based on time. Runs every 5 minutes."""
    
    current_time = get_datetime(now())
    
    # Flights that should have departed
    departed = frappe.get_all(
        "Flight Schedule",
        filters={"status": "Scheduled", "departure_date": ["<=", current_time.date()]}
    )
    
    for flight_data in departed:
        flight = frappe.get_doc("Flight Schedule", flight_data.name)
        departure = get_datetime(f"{flight.departure_date} {flight.departure_time}")
        
        if current_time > departure:
            flight.status = "Departed"
            flight.save()
            frappe.db.commit()
    
    # Flights that should have arrived
    arrived = frappe.get_all(
        "Flight Schedule",
        filters={"status": "Departed", "arrival_date": ["<=", current_time.date()]}
    )
    
    for flight_data in arrived:
        flight = frappe.get_doc("Flight Schedule", flight_data.name)
        arrival = get_datetime(f"{flight.arrival_date} {flight.arrival_time}")
        
        if current_time > arrival:
            flight.status = "Arrived"
            flight.save()
            frappe.db.commit()
    
    return {"success": True, "departed": len(departed), "arrived": len(arrived)}


# =========================================================
# TASK 4: RELEASE SPECIFIC SEAT (HELPER)
# =========================================================

@frappe.whitelist()
def release_seat(seat_name):
    """Manually release a single seat"""
    
    seat = frappe.get_doc("Seat Inventory", seat_name)
    
    if seat.status not in ("Hold", "Reserved"):
        return {"success": False, "message": f"Seat {seat.seat_number} is not reserved"}
    
    seat.status = "Available"
    seat.hold_expiry = None
    seat.booking_reference = None
    seat.save()
    frappe.db.commit()
    
    return {"success": True, "message": f"Seat {seat.seat_number} released"}