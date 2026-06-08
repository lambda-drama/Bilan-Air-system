# bilan_air/api/baggage_tracking.py

import frappe
from frappe import _
from frappe.utils import format_datetime, get_datetime


@frappe.whitelist()
def get_baggage_policy(seat_class=None, seat_inventory_name=None):
	"""Allowance and excess fee for portal UI."""
	from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import get_baggage_allowance

	return get_baggage_allowance(seat_class, seat_inventory_name)


def preview_baggage_fee(weight_kg, seat_class=None, seat_inventory_name=None):
	from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import calculate_excess_fee

	return calculate_excess_fee(weight_kg, seat_class, seat_inventory_name)


@frappe.whitelist()
def add_baggage(pnr, weight_kg, passenger_id=None, passenger_name=None, passenger_index=None):
    """Create baggage tracking record. ``pnr`` may be reservation ref (RES-…) or customer PNR."""

    from bilan_sky.bilan_air_booking_system.utils.reservation_status import resolve_air_booking

    from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import calculate_excess_fee

    booking_name = resolve_air_booking(pnr)
    booking = frappe.get_doc("Air Booking", booking_name)
    passenger_row = None

    if passenger_index is not None:
        passenger_row = booking.passengers[int(passenger_index)]
        passenger_name = passenger_row.passenger_name
        passenger_id = passenger_row.passenger
    elif passenger_id and not passenger_name:
        passenger_name = frappe.db.get_value("Passenger", passenger_id, "full_name")

    if not passenger_name:
        frappe.throw("Traveler name is required for baggage tracking.")

    seat_inventory_name = passenger_row.seat_number if passenger_row else None
    excess_result = calculate_excess_fee(weight_kg, seat_inventory_name=seat_inventory_name)
    is_excess = excess_result["is_excess"]
    fee = excess_result["fee"]
    
    baggage = frappe.get_doc({
        "doctype": "Baggage Tracking",
        "air_booking": booking.name,
        "passenger": passenger_id,
        "passenger_name": passenger_name,
        "flight_schedule": booking.flight_schedule,
        "weight_kg": weight_kg,
        "baggage_fee": fee,
        "is_excess": is_excess,
        "status": "Checked In"
    })
    baggage.insert(ignore_permissions=True)

    link_row = {
        "doctype": "Air Booking Baggage Link",
        "parent": booking.name,
        "parenttype": "Air Booking",
        "parentfield": "baggage_tracking_numbers",
        "baggage_tracking": baggage.name,
    }
    if booking.docstatus == 1:
        frappe.get_doc(link_row).insert(ignore_permissions=True)
    else:
        booking.append("baggage_tracking_numbers", {"baggage_tracking": baggage.name})
        booking.flags.ignore_validate = True
        booking.save(ignore_permissions=True)

    frappe.db.commit()
    
    return {
        "tracking_number": baggage.tracking_number,
        "weight_kg": weight_kg,
        "fee": fee,
        "is_excess": is_excess,
        "passenger_name": passenger_name,
    }

def _passenger_last_name(name):
	parts = (name or "").strip().split()
	return parts[-1].upper() if parts else (name or "").upper()


def _passenger_row_for_baggage(booking, baggage):
	for pax in booking.passengers or []:
		if baggage.passenger_name and pax.passenger_name == baggage.passenger_name:
			return pax
		if baggage.passenger and pax.passenger == baggage.passenger:
			return pax
	return None


def _build_baggage_print_payload(baggage):
	from bilan_sky.bilan_air_booking_system.utils.airports import (
		airport_display_label,
		get_airport_iata,
	)
	from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import get_baggage_allowance

	booking = frappe.get_doc("Air Booking", baggage.air_booking, ignore_permissions=True)
	flight = frappe.get_doc("Flight Schedule", baggage.flight_schedule, ignore_permissions=True)
	route = frappe.get_doc("Flight Route", flight.route, ignore_permissions=True)
	pax = _passenger_row_for_baggage(booking, baggage)
	allowance = get_baggage_allowance(seat_inventory_name=pax.seat_number if pax else None)

	origin_iata = get_airport_iata(route.origin_airport) or route.origin_airport
	dest_iata = get_airport_iata(route.destination_airport) or route.destination_airport

	all_tags = frappe.get_all(
		"Baggage Tracking",
		filters={"air_booking": booking.name},
		fields=["name", "tracking_number"],
		order_by="creation asc",
	)
	sequence_no = 1
	for idx, row in enumerate(all_tags, start=1):
		if row.name == baggage.name:
			sequence_no = idx
			break

	checked_in_at = None
	if baggage.checked_in_at:
		checked_in_at = format_datetime(get_datetime(baggage.checked_in_at), "dd MMM yyyy, HH:mm")

	return {
		"airline_name": "BILAN AIR",
		"airline_tagline": "Beyond Skies Together",
		"tracking_number": baggage.tracking_number,
		"passenger_name": baggage.passenger_name,
		"passenger_last_name": _passenger_last_name(baggage.passenger_name),
		"reservation_ref": booking.name,
		"pnr": booking.pnr or booking.get_public_reference(),
		"flight_number": flight.flight_number,
		"origin_code": origin_iata,
		"destination_code": dest_iata,
		"origin_label": airport_display_label(route.origin_airport),
		"destination_label": airport_display_label(route.destination_airport),
		"departure_date": str(flight.departure_date) if flight.departure_date else None,
		"departure_time": flight.departure_time,
		"weight_kg": baggage.weight_kg,
		"baggage_fee": baggage.baggage_fee,
		"is_excess": bool(baggage.is_excess),
		"allowance_kg": allowance["checked_kg"],
		"status": baggage.status,
		"checked_in_at": checked_in_at,
		"sequence_no": sequence_no,
		"total_bags": len(all_tags),
		"barcode_data": f"{baggage.tracking_number}|{dest_iata}|{flight.flight_number}|{booking.pnr or booking.name}",
	}


@frappe.whitelist()
def get_baggage_print_data(tracking_number):
	"""Print payload for a baggage tag or passenger receipt."""
	from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff

	require_portal_staff()
	if not tracking_number:
		frappe.throw(_("Tracking number is required."))

	baggage_name = frappe.db.get_value(
		"Baggage Tracking", {"tracking_number": tracking_number}, "name"
	) or tracking_number
	if not frappe.db.exists("Baggage Tracking", baggage_name):
		frappe.throw(_("Baggage tag not found."))

	baggage = frappe.get_doc("Baggage Tracking", baggage_name)
	baggage.check_permission("read")

	return {
		"tracking_number": baggage.tracking_number,
		"baggage": _build_baggage_print_payload(baggage),
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