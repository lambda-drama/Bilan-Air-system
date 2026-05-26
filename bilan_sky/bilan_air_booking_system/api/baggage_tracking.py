# bilan_air/api/baggage_tracking.py

import frappe

@frappe.whitelist()
def add_baggage(pnr, passenger_id, weight_kg):
    """Create baggage tracking record"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    settings = frappe.get_single("BA Settings")
    
    is_excess = weight_kg > settings.max_baggage_kg
    fee = 0
    
    if is_excess:
        excess = weight_kg - settings.max_baggage_kg
        fee = excess * settings.excess_baggage_fee
    
    baggage = frappe.get_doc({
        "doctype": "Baggage Tracking",
        "air_booking": pnr,
        "passenger": passenger_id,
        "flight_schedule": booking.flight_schedule,
        "weight_kg": weight_kg,
        "baggage_fee": fee,
        "is_excess": is_excess,
        "status": "Checked In"
    })
    baggage.insert()
    frappe.db.commit()
    
    booking.append("baggage_tracking_numbers", {
        "baggage_tracking": baggage.name
    })
    booking.save()
    frappe.db.commit()
    
    return {
        "tracking_number": baggage.name,
        "weight": weight_kg,
        "fee": fee,
        "is_excess": is_excess
    }

@frappe.whitelist(allow_guest=True)
def trace_baggage(tracking_number):
    """Track baggage by tracking number"""
    
    baggage = frappe.get_doc("Baggage Tracking", tracking_number)
    
    return {
        "tracking_number": baggage.name,
        "status": baggage.status,
        "passenger": baggage.passenger,
        "flight": baggage.flight_schedule,
        "weight_kg": baggage.weight_kg
    }