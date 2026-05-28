# bilan_air/api/baggage_tracking.py

import frappe


@frappe.whitelist()
def get_baggage_policy():
	"""Allowance and excess fee for portal UI."""
	settings = frappe.get_single("BA Settings")
	return {
		"max_baggage_kg": settings.max_baggage_kg,
		"excess_baggage_fee_per_kg": settings.excess_baggage_fee,
	}


def preview_baggage_fee(weight_kg):
	settings = frappe.get_single("BA Settings")
	weight_kg = float(weight_kg or 0)
	if weight_kg <= 0:
		return {"weight_kg": 0, "is_excess": False, "fee": 0}
	is_excess = weight_kg > settings.max_baggage_kg
	fee = 0
	if is_excess:
		excess = weight_kg - settings.max_baggage_kg
		fee = excess * settings.excess_baggage_fee
	return {"weight_kg": weight_kg, "is_excess": is_excess, "fee": fee}


@frappe.whitelist()
def add_baggage(pnr, weight_kg, passenger_id=None, passenger_name=None, passenger_index=None):
    """Create baggage tracking record"""
    
    booking = frappe.get_doc("Air Booking", pnr)
    settings = frappe.get_single("BA Settings")

    if passenger_index is not None:
        row = booking.passengers[int(passenger_index)]
        passenger_name = row.passenger_name
        passenger_id = row.passenger
    elif passenger_id and not passenger_name:
        passenger_name = frappe.db.get_value("Passenger", passenger_id, "full_name")

    if not passenger_name:
        frappe.throw("Traveler name is required for baggage tracking.")
    
    is_excess = weight_kg > settings.max_baggage_kg
    fee = 0
    
    if is_excess:
        excess = weight_kg - settings.max_baggage_kg
        fee = excess * settings.excess_baggage_fee
    
    baggage = frappe.get_doc({
        "doctype": "Baggage Tracking",
        "air_booking": pnr,
        "passenger": passenger_id,
        "passenger_name": passenger_name,
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
        "tracking_number": baggage.tracking_number,
        "weight_kg": weight_kg,
        "fee": fee,
        "is_excess": is_excess,
        "passenger_name": passenger_name,
    }

@frappe.whitelist(allow_guest=True)
def trace_baggage(tracking_number):
    """Track baggage by tracking number"""
    
    baggage_name = frappe.db.get_value(
        "Baggage Tracking", {"tracking_number": tracking_number}, "name"
    ) or tracking_number
    baggage = frappe.get_doc("Baggage Tracking", baggage_name)

    return {
        "tracking_number": baggage.tracking_number,
        "status": baggage.status,
        "passenger": baggage.passenger,
        "passenger_name": baggage.passenger_name,
        "flight": baggage.flight_schedule,
        "weight_kg": baggage.weight_kg
    }