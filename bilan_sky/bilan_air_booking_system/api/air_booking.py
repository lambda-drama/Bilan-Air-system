# bilan_air/api/air_booking.py

import frappe
from frappe import _
from frappe.utils import add_to_date, flt, get_datetime, now, strip_html

from bilan_sky.bilan_air_booking_system.doctype.seat_inventory.seat_inventory import (
    prepare_seat_for_new_booking,
)
from bilan_sky.bilan_air_booking_system.utils.airports import airport_display_label, get_airport_iata
from bilan_sky.bilan_air_booking_system.utils.reservation_status import CONFIRM, resolve_air_booking


def _load_booking(identifier, **kwargs):
	return frappe.get_doc("Air Booking", resolve_air_booking(identifier), **kwargs)


def _validate_seat_matches_cabin(seat_inventory_name: str, expected_cabin: str) -> None:
	seat_class_link = frappe.db.get_value("Seat Inventory", seat_inventory_name, "seat_class")
	if not seat_class_link:
		frappe.throw(_("Seat not found."))
	class_name = frappe.db.get_value("Seat Class", seat_class_link, "class_name") or seat_class_link
	if class_name != expected_cabin:
		seat_label = frappe.db.get_value("Seat Inventory", seat_inventory_name, "seat_number") or seat_inventory_name
		frappe.throw(
			_("Seat {0} is in {1}. Only {2} seats can be booked for this cabin.").format(
				seat_label, class_name, expected_cabin
			)
		)


@frappe.whitelist()
def get_schedule_journey_defaults(schedule_name):
	"""Boarding/deboarding defaults for Desk when a flight schedule is selected."""
	if not schedule_name or not frappe.db.exists("Flight Schedule", schedule_name):
		frappe.throw(_("Flight schedule not found"))
	frappe.get_doc("Flight Schedule", schedule_name).check_permission("read")
	from bilan_sky.bilan_air_booking_system.utils.flight_segments import default_journey_airports

	return default_journey_airports(schedule_name)

@frappe.whitelist(allow_guest=True)
def create_booking(booking_data):
    """
    Create a new booking.

    booking_source:
      - office: desk booking, travelers stay on the booking only; payer becomes ERPNext Customer on invoice.
      - online: public site, optional Passenger profiles + website login when register_profile is true.
    """
    if isinstance(booking_data, str):
        import json

        booking_data = json.loads(booking_data)

    booking_source = (booking_data.get("booking_source") or "online").strip().lower()
    is_office = booking_source == "office"

    passenger_links = []

    for pax in booking_data.get("passengers", []):
        passenger_name = (pax.get("passenger_name") or pax.get("full_name") or "").strip()
        if not passenger_name:
            frappe.throw("Each traveler must have a passenger name.")

        passenger_link = pax.get("passenger")
        id_number = pax.get("id_number")

        if not passenger_link and id_number:
            passenger_link = frappe.db.exists("Passenger", {"id_number": id_number})

        register_profile = pax.get("register_profile")
        if register_profile is None:
            register_profile = not is_office

        if is_office:
            register_profile = False
        elif frappe.session.user and frappe.session.user != "Guest":
            register_profile = True

        if not passenger_link and register_profile:
            existing = frappe.db.exists("Passenger", {"id_number": id_number}) if id_number else None
            if existing:
                passenger_link = existing
            else:
                profile = frappe.get_doc({
                    "doctype": "Passenger",
                    "full_name": passenger_name,
                    "passenger_type": pax.get("passenger_type", "Adult"),
                    "id_number": id_number,
                    "date_of_birth": pax.get("date_of_birth"),
                    "phone_number": pax.get("phone_number") or booking_data.get("payer_phone"),
                    "email": pax.get("email") or booking_data.get("payer_email"),
                })
                profile.flags.create_login_user = True
                profile.insert(ignore_permissions=True)
                passenger_link = profile.name

        passenger_links.append({
            "passenger_name": passenger_name,
            "passenger": passenger_link,
            "id_number": id_number,
            "passenger_type": pax.get("passenger_type", "Adult"),
            "seat_number": pax.get("seat_number"),
            "fare_paid": 0,
        })

    expected_cabin = (booking_data.get("seat_class") or "").strip()

    for row in passenger_links:
        if row.get("seat_number"):
            prepare_seat_for_new_booking(row["seat_number"])
            if expected_cabin:
                _validate_seat_matches_cabin(row["seat_number"], expected_cabin)

    schedule_name = booking_data.get("flight_schedule")
    boarding = booking_data.get("boarding_airport")
    deboarding = booking_data.get("deboarding_airport")

    from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
        get_schedule_segments,
        schedule_is_multi_segment,
    )

    if schedule_is_multi_segment(schedule_name):
        if not boarding or not deboarding:
            frappe.throw("Select boarding and deboarding airports for this multi-stop flight.")
    else:
        route = frappe.db.get_value("Flight Schedule", schedule_name, "route")
        segments = get_schedule_segments(schedule_name)
        if len(segments) == 1:
            boarding = boarding or segments[0]["origin_airport"]
            deboarding = deboarding or segments[0]["destination_airport"]

    booking = frappe.get_doc({
        "doctype": "Air Booking",
        "flight_schedule": schedule_name,
        "boarding_airport": boarding,
        "deboarding_airport": deboarding,
        "payer_name": booking_data.get("payer_name"),
        "payer_email": booking_data.get("payer_email"),
        "payer_phone": booking_data.get("payer_phone"),
        "passengers": passenger_links,
        "reservation_status": "Booked",
        "payment_status": "Pending",
        "booking_date": now()
    })
    
    from bilan_sky.bilan_air_booking_system.utils.booking_agent import (
        validate_agent_can_create_booking,
    )

    agent = validate_agent_can_create_booking()
    if agent:
        booking.booking_agent = agent.name

    booking.insert()

    from bilan_sky.bilan_air_booking_system.utils.seat_booking import reserve_seat_for_booking

    for passenger in booking.passengers:
        result = reserve_seat_for_booking(
            passenger.seat_number,
            booking.name,
            flight_schedule=schedule_name,
            boarding_airport=boarding,
            deboarding_airport=deboarding,
        )
        if not result.get("success"):
            frappe.throw(result.get("message") or "Could not reserve seat")

    booking.calculate_total_fare()
    booking.flags.ignore_validate = True
    booking.save(ignore_permissions=True)
    booking.flags.ignore_validate = False
    frappe.db.commit()

    settings = frappe.get_single("BA Settings")
    hold_minutes = int(settings.hold_duration or 15)

    return {
        "reservation_ref": booking.name,
        "pnr": booking.pnr,
        "status": booking.reservation_status,
        "reservation_status": booking.reservation_status,
        "payment_status": booking.payment_status,
        "total_fare": booking.total_fare,
        "hold_duration_minutes": hold_minutes,
    }

@frappe.whitelist(allow_guest=True)
def process_payment(pnr, payment_method, transaction_id=None):
    """Confirm payment: invoice, payment entry, and booking confirmation."""
    
    booking = _load_booking(pnr)
    
    if booking.payment_status == "Paid" and booking.payment_entry:
        return {"error": "Booking already paid"}

    booking.payment_method = payment_method
    result = booking.confirm_payment_and_invoice()
    result["pnr"] = booking.pnr
    result["reservation_ref"] = booking.name
    result["total"] = booking.total_fare
    return result

@frappe.whitelist()
def generate_tickets_for_booking(pnr):
	"""Generate ticket numbers for all passengers on an Air Booking."""
	booking = _load_booking(pnr)
	tickets = booking.generate_ticket_numbers(show_message=False)
	booking.flags.ignore_validate = True
	booking.save()
	frappe.db.commit()

	return {
		"pnr": booking.pnr,
		"reservation_ref": booking.name,
		"count": len(tickets),
		"ticket_numbers": tickets,
	}


def _booking_baggage_rows(booking):
	rows = []
	for link in booking.baggage_tracking_numbers or []:
		if not link.baggage_tracking:
			continue
		data = frappe.db.get_value(
			"Baggage Tracking",
			link.baggage_tracking,
			[
				"name",
				"tracking_number",
				"passenger_name",
				"passenger",
				"weight_kg",
				"baggage_fee",
				"is_excess",
				"status",
			],
			as_dict=True,
		)
		if data:
			data["name"] = data.get("name") or link.baggage_tracking
			rows.append(data)
	return rows


def _baggage_policy():
	settings = frappe.get_single("BA Settings")
	return {
		"max_baggage_kg": settings.max_baggage_kg,
		"excess_baggage_fee_per_kg": settings.excess_baggage_fee,
		"carry_on_kg": 7,
	}


def _last_name(name):
	if not name:
		return ""
	parts = (name or "").strip().split()
	return parts[-1].lower() if parts else ""


def _user_owns_booking(booking):
	if frappe.session.user in (None, "Guest"):
		return False
	email = frappe.db.get_value("User", frappe.session.user, "email")
	return bool(email and booking.payer_email and email.lower() == booking.payer_email.lower())


def _booking_last_names(booking):
	names = set()
	if booking.payer_name:
		names.add(_last_name(booking.payer_name))
	for pax in booking.passengers or []:
		if pax.passenger_name:
			names.add(_last_name(pax.passenger_name))
	return {name for name in names if name}


def _verify_checkin_identity(booking, last_name=None):
	if _user_owns_booking(booking):
		return True

	last_name = (last_name or "").strip()
	if not last_name:
		frappe.throw(_("Last name is required."))

	ln = _last_name(last_name)
	if ln in _booking_last_names(booking):
		return True

	frappe.throw(_("Last name does not match this booking. Please check your details."))


def _check_in_window_status(flight_schedule_name):
	flight = frappe.get_doc("Flight Schedule", flight_schedule_name, ignore_permissions=True)
	departure = get_datetime(f"{flight.departure_date} {flight.departure_time}")
	now_dt = get_datetime()
	opens_at = add_to_date(departure, hours=-24)
	closes_at = add_to_date(departure, hours=-2)
	return {
		"open": opens_at <= now_dt <= closes_at,
		"opens_at": str(opens_at),
		"closes_at": str(closes_at),
		"departure_at": str(departure),
	}


def _serialize_booking_details(booking):
	passengers = []
	for pax in booking.passengers:
		passenger_type = pax.passenger_type or "Adult"
		if pax.passenger:
			profile = frappe.get_doc("Passenger", pax.passenger, ignore_permissions=True)
			passenger_type = profile.passenger_type or passenger_type

		seat_label = pax.seat_number
		if pax.seat_number and frappe.db.exists("Seat Inventory", pax.seat_number):
			seat_label = frappe.db.get_value("Seat Inventory", pax.seat_number, "seat_number") or seat_label

		passengers.append({
			"row_name": pax.name,
			"name": pax.passenger_name,
			"passenger": pax.passenger,
			"id_number": pax.id_number,
			"type": passenger_type,
			"seat": pax.seat_number,
			"seat_label": seat_label,
			"ticket_number": pax.ticket_number,
			"check_in_status": pax.check_in_status,
			"can_print_ticket": _passenger_can_print_ticket(booking, pax),
		})

	flight = frappe.get_doc("Flight Schedule", booking.flight_schedule, ignore_permissions=True)
	route = frappe.get_doc("Flight Route", flight.route, ignore_permissions=True)
	origin_iata = get_airport_iata(route.origin_airport) or route.origin_airport
	dest_iata = get_airport_iata(route.destination_airport) or route.destination_airport
	check_in_window = _check_in_window_status(booking.flight_schedule)
	all_checked_in = all(
		p.check_in_status in ("Checked In", "Boarded") for p in booking.passengers
	) if booking.passengers else False

	return {
		"reservation_ref": booking.name,
		"pnr": booking.pnr,
		"public_reference": booking.get_public_reference(),
		"status": booking.reservation_status,
		"reservation_status": booking.reservation_status,
		"payment_status": booking.payment_status,
		"total_fare": booking.total_fare,
		"payer_name": booking.payer_name,
		"payer_phone": booking.payer_phone,
		"payer_email": booking.payer_email,
		"passengers": passengers,
		"baggage": _booking_baggage_rows(booking),
		"baggage_policy": _baggage_policy(),
		"baggage_fees_total": booking._get_baggage_total_fee(),
		"check_in_window": check_in_window,
		"can_check_in": (
			booking.reservation_status == CONFIRM
			and booking.payment_status == "Paid"
			and bool(booking.pnr)
			and check_in_window["open"]
			and not all_checked_in
		),
		"all_checked_in": all_checked_in,
		"reason_for_cancel": strip_html(booking.reason_for_cancel or "").strip() or None,
		"flight": {
			"flight_number": flight.flight_number,
			"origin": route.origin_airport,
			"destination": route.destination_airport,
			"origin_code": origin_iata,
			"destination_code": dest_iata,
			"origin_label": airport_display_label(route.origin_airport),
			"destination_label": airport_display_label(route.destination_airport),
			"departure_date": str(flight.departure_date),
			"departure_time": flight.departure_time,
			"arrival_date": str(flight.arrival_date),
			"arrival_time": flight.arrival_time,
			"status": flight.status,
		},
	}


def _airport_full_label(airport_link):
	row = frappe.db.get_value(
		"Airport",
		airport_link,
		["airport_name", "city", "iata_code"],
		as_dict=True,
	)
	if row and row.get("airport_name"):
		return row.airport_name
	return airport_display_label(airport_link)


def _seat_class_label(seat_inventory_name):
	if not seat_inventory_name or not frappe.db.exists("Seat Inventory", seat_inventory_name):
		return "Economy"
	seat_class_link = frappe.db.get_value("Seat Inventory", seat_inventory_name, "seat_class")
	if not seat_class_link:
		return "Economy"
	return frappe.db.get_value("Seat Class", seat_class_link, "class_name") or "Economy"


def _default_ticket_terms():
	row = frappe.get_all(
		"Ticket Terms",
		filters={"default": 1},
		fields=["title", "terms_conditions"],
		limit=1,
	)
	if not row:
		row = frappe.get_all(
			"Ticket Terms",
			fields=["title", "terms_conditions"],
			order_by="modified desc",
			limit=1,
		)
	if not row:
		return {"title": "", "terms_html": ""}
	return {
		"title": row[0].title,
		"terms_html": strip_html(row[0].terms_conditions or "").strip(),
	}


def _passenger_can_print_ticket(booking, pax):
	return (
		booking.reservation_status == CONFIRM
		and bool((booking.pnr or "").strip())
		and bool((pax.ticket_number or "").strip())
	)


def _build_passenger_ticket_payload(booking, pax, sequence_no):
	flight = frappe.get_doc("Flight Schedule", booking.flight_schedule, ignore_permissions=True)
	route = frappe.get_doc("Flight Route", flight.route, ignore_permissions=True)
	origin_iata = get_airport_iata(route.origin_airport) or route.origin_airport
	dest_iata = get_airport_iata(route.destination_airport) or route.destination_airport
	departure = get_datetime(f"{flight.departure_date} {flight.departure_time}")
	boarding_time = add_to_date(departure, minutes=-40)
	gate_close_time = add_to_date(departure, minutes=-15)

	seat_label = pax.seat_number
	if pax.seat_number and frappe.db.exists("Seat Inventory", pax.seat_number):
		seat_label = frappe.db.get_value("Seat Inventory", pax.seat_number, "seat_number") or seat_label

	policy = _baggage_policy()
	settings = frappe.get_single("BA Settings")

	return {
		"airline_name": "BILAN AIR",
		"airline_tagline": "Beyond Skies Together",
		"passenger_name": (pax.passenger_name or "").upper(),
		"sequence_no": sequence_no,
		"booking_ref": booking.pnr or booking.get_public_reference(),
		"ticket_number": pax.ticket_number,
		"flight_number": flight.flight_number,
		"origin_code": origin_iata,
		"destination_code": dest_iata,
		"origin_label": _airport_full_label(route.origin_airport),
		"destination_label": _airport_full_label(route.destination_airport),
		"seat_class": _seat_class_label(pax.seat_number),
		"departure_date": str(flight.departure_date),
		"departure_time": flight.departure_time,
		"arrival_time": flight.arrival_time,
		"boarding_time": str(boarding_time)[11:19] if boarding_time else flight.departure_time,
		"gate_close_time": str(gate_close_time)[11:19] if gate_close_time else flight.departure_time,
		"seat": seat_label,
		"gate": "TBC",
		"zone": str(sequence_no),
		"passenger_type": pax.passenger_type or "Adult",
		"baggage_policy": {
			"checked_kg": policy.get("max_baggage_kg"),
			"carry_on_kg": policy.get("carry_on_kg"),
			"excess_fee_per_kg": settings.excess_baggage_fee,
		},
		"ticket_terms": _default_ticket_terms(),
		"barcode_data": f"{booking.pnr or booking.name}|{pax.ticket_number}|{origin_iata}|{dest_iata}|{flight.flight_number}",
	}


def _resolve_passenger_row(booking, passenger_row=None, passenger_index=None):
	if passenger_row:
		for pax in booking.passengers:
			if pax.name == passenger_row:
				return pax
		frappe.throw(_("Passenger row not found on this booking."))

	idx = int(passenger_index or 0)
	if idx < 0 or idx >= len(booking.passengers):
		frappe.throw(_("Invalid passenger index."))
	return booking.passengers[idx]


@frappe.whitelist()
def get_passenger_ticket_print_data(pnr, passenger_row=None, passenger_index=None):
	"""Print payload for one confirmed passenger ticket (Air Booking child row)."""
	booking = _load_booking(pnr)
	booking.check_permission("read")

	pax = _resolve_passenger_row(booking, passenger_row, passenger_index)
	if not _passenger_can_print_ticket(booking, pax):
		frappe.throw(
			_("Ticket is available only after the booking is confirmed and a ticket number is issued.")
		)

	sequence_no = 1
	for idx, row in enumerate(booking.passengers, start=1):
		if row.name == pax.name:
			sequence_no = idx
			break

	return {
		"reservation_ref": booking.name,
		"pnr": booking.pnr,
		"passenger_row": pax.name,
		"ticket": _build_passenger_ticket_payload(booking, pax, sequence_no),
	}


def _build_boarding_pass_payload(booking, pax, sequence_no):
	flight = frappe.get_doc("Flight Schedule", booking.flight_schedule, ignore_permissions=True)
	route = frappe.get_doc("Flight Route", flight.route, ignore_permissions=True)
	origin_iata = get_airport_iata(route.origin_airport) or route.origin_airport
	dest_iata = get_airport_iata(route.destination_airport) or route.destination_airport
	departure = get_datetime(f"{flight.departure_date} {flight.departure_time}")
	boarding_time = add_to_date(departure, minutes=-45)
	gate_close_time = add_to_date(departure, minutes=-15)

	seat_label = pax.seat_number
	if pax.seat_number and frappe.db.exists("Seat Inventory", pax.seat_number):
		seat_label = frappe.db.get_value("Seat Inventory", pax.seat_number, "seat_number") or seat_label

	return {
		"airline_name": "BILAN AIR",
		"airline_tagline": "Beyond Skies Together",
		"passenger_name": (pax.passenger_name or "").upper(),
		"passenger_type": pax.passenger_type or "Adult",
		"sequence_no": sequence_no,
		"booking_ref": booking.pnr or booking.get_public_reference(),
		"reservation_ref": booking.name,
		"pnr": booking.pnr or booking.get_public_reference(),
		"ticket_number": pax.ticket_number,
		"flight_number": flight.flight_number,
		"origin_code": origin_iata,
		"destination_code": dest_iata,
		"origin_label": airport_display_label(route.origin_airport),
		"destination_label": airport_display_label(route.destination_airport),
		"departure_date": str(flight.departure_date),
		"departure_time": flight.departure_time,
		"arrival_time": flight.arrival_time,
		"boarding_time": str(boarding_time)[11:19] if boarding_time else flight.departure_time,
		"gate_close_time": str(gate_close_time)[11:19] if gate_close_time else flight.departure_time,
		"seat": seat_label,
		"gate": "TBC",
		"zone": str(sequence_no),
		"seat_class": _seat_class_label(pax.seat_number),
		"check_in_status": pax.check_in_status,
		"barcode_data": (
			f"{booking.pnr or booking.name}|{pax.ticket_number or ''}|{origin_iata}|{dest_iata}|"
			f"{flight.flight_number}|{seat_label}"
		),
	}


def _boarding_passes_for_booking(booking):
	passes = []
	for idx, pax in enumerate(booking.passengers, start=1):
		if pax.check_in_status not in ("Checked In", "Boarded"):
			continue
		passes.append(_build_boarding_pass_payload(booking, pax, idx))
	return passes


@frappe.whitelist(allow_guest=True)
def get_boarding_pass_print_data(pnr, passenger_row=None, passenger_index=None):
	"""Print payload for one checked-in passenger boarding pass."""
	booking = _load_booking(pnr, ignore_permissions=True)
	pax = _resolve_passenger_row(booking, passenger_row, passenger_index)

	if pax.check_in_status not in ("Checked In", "Boarded"):
		frappe.throw(_("Boarding pass is available only after check-in."))

	sequence_no = 1
	for idx, row in enumerate(booking.passengers, start=1):
		if row.name == pax.name:
			sequence_no = idx
			break

	return {
		"reservation_ref": booking.name,
		"pnr": booking.pnr,
		"passenger_row": pax.name,
		"boarding_pass": _build_boarding_pass_payload(booking, pax, sequence_no),
	}


@frappe.whitelist(allow_guest=True)
def fetch_booking_details(pnr):
    """Get booking by reservation ref (RES-…) or customer PNR."""
    
    booking = _load_booking(pnr, ignore_permissions=True)
    return _serialize_booking_details(booking)

@frappe.whitelist(allow_guest=True)
def cancel_booking(pnr, reason_for_cancel=None):
    """Cancel a booking"""
    
    booking = _load_booking(pnr, ignore_permissions=True)
    booking.cancel_booking(reason_for_cancel=reason_for_cancel)
    
    return {
        "success": True,
        "reservation_ref": booking.name,
        "pnr": booking.pnr,
        "status": booking.reservation_status,
    }


@frappe.whitelist(allow_guest=True)
def lookup_booking_for_checkin(pnr, last_name=None):
	"""Verify reservation ref / PNR + last name (or logged-in payer) and return booking."""
	key = (pnr or "").strip()
	if not key:
		frappe.throw(_("Booking reference or PNR is required."))

	booking_name = resolve_air_booking(key, throw=False)
	if not booking_name:
		frappe.throw(_("Booking not found. Please check your reference or PNR."))

	booking = frappe.get_doc("Air Booking", booking_name, ignore_permissions=True)
	_verify_checkin_identity(booking, last_name)
	return _serialize_booking_details(booking)


@frappe.whitelist(allow_guest=True)
def self_check_in(pnr, last_name=None, passenger_index=0, baggage_weight=0):
	"""Guest self check-in for one traveler on a booking."""
	pnr = (pnr or "").strip()
	booking = _load_booking(pnr, ignore_permissions=True)
	_verify_checkin_identity(booking, last_name)

	window = _check_in_window_status(booking.flight_schedule)
	if not window["open"]:
		frappe.throw("Online check-in is only available from 24 hours until 2 hours before departure.")

	result = booking.check_in_passenger(int(passenger_index), float(baggage_weight or 0))
	booking.reload()
	return {
		**result,
		"booking": _serialize_booking_details(booking),
		"boarding_passes": _boarding_passes_for_booking(booking),
	}


@frappe.whitelist(allow_guest=True)
def self_check_in_all(pnr, last_name=None):
	"""Guest self check-in for all travelers on a booking."""
	pnr = (pnr or "").strip()
	booking = _load_booking(pnr, ignore_permissions=True)
	_verify_checkin_identity(booking, last_name)

	window = _check_in_window_status(booking.flight_schedule)
	if not window["open"]:
		frappe.throw("Online check-in is only available from 24 hours until 2 hours before departure.")

	result = booking.check_in_all_passengers()
	booking.reload()
	return {
		**result,
		"booking": _serialize_booking_details(booking),
		"boarding_passes": _boarding_passes_for_booking(booking),
	}

@frappe.whitelist()
def process_check_in(pnr, passenger_index, baggage_weight=0):
    """Check in a passenger; optional baggage_weight (kg) creates a baggage tag."""
    
    booking = _load_booking(pnr)
    result = booking.check_in_passenger(int(passenger_index), float(baggage_weight or 0))
    
    return result

@frappe.whitelist()
def mark_boarded(pnr, passenger_index):
    """Mark passenger as boarded"""
    
    booking = _load_booking(pnr)
    result = booking.board_passenger(int(passenger_index))
    
    return result


@frappe.whitelist()
def check_in_all_passengers(pnr):
    booking = _load_booking(pnr)
    return booking.check_in_all_passengers()


@frappe.whitelist()
def board_all_passengers(pnr):
    booking = _load_booking(pnr)
    return booking.board_all_passengers()


@frappe.whitelist()
def mark_booking_arrived(pnr):
    booking = _load_booking(pnr)
    return booking.mark_arrived()


@frappe.whitelist()
def create_sales_invoice_from_booking(pnr, submit=0):
    booking = _load_booking(pnr)
    return booking.create_sales_invoice(submit=frappe.utils.cint(submit))


@frappe.whitelist()
def get_payment_confirmation_options():
	"""Modes of payment and bank/cash accounts for portal confirm-payment dialog."""
	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting
	from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

	default_mode = get_ba_setting("default_mode_of_payment", "Cash")
	default_cash = get_ba_setting("default_cash_account")
	default_mpesa = get_ba_setting("default_mpesa_account")

	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.api.remote_accounting import (
			get_remote_accounting_options,
		)

		remote = get_remote_accounting_options()
		return {
			"remote": True,
			"company": remote.get("company"),
			"site_url": remote.get("site_url"),
			"default_mode_of_payment": default_mode,
			"default_cash_account": default_cash,
			"default_mpesa_account": default_mpesa,
			"modes_of_payment": remote.get("modes_of_payment") or [],
			"accounts": remote.get("accounts") or [],
		}

	company = frappe.db.get_single_value("Global Defaults", "default_company")
	modes = []
	for row in frappe.get_all("Mode of Payment", filters={"enabled": 1}, fields=["name"], order_by="name asc"):
		account = frappe.db.get_value(
			"Mode of Payment Account",
			{"parent": row.name, "company": company},
			"default_account",
		)
		modes.append({"name": row.name, "default_account": account})

	accounts = frappe.get_all(
		"Account",
		filters={
			"company": company,
			"is_group": 0,
			"account_type": ["in", ["Bank", "Cash"]],
			"disabled": 0,
		},
		fields=["name"],
		order_by="name asc",
		limit=200,
	)

	return {
		"remote": False,
		"company": company,
		"default_mode_of_payment": default_mode,
		"default_cash_account": default_cash,
		"default_mpesa_account": default_mpesa,
		"modes_of_payment": modes,
		"accounts": accounts,
	}


@frappe.whitelist()
def confirm_payment_and_invoice_from_booking(pnr, payment_method=None, paid_account=None):
    booking = _load_booking(pnr)
    booking.check_permission("write")
    return booking.confirm_payment_and_invoice(
        payment_method=payment_method,
        paid_account=paid_account,
    )


@frappe.whitelist()
def confirm_booking_on_credit(pnr):
	"""Issue PNR and tickets using agent credit (logged-in agent or Booking Agent on the reservation)."""
	booking = _load_booking(pnr)
	booking.check_permission("write")
	booking.calculate_total_fare()
	if not flt(booking.total_fare):
		frappe.throw(
			_("Total fare is zero. Assign seats from Seat Inventory, save, and ensure route base fares are set."),
			title=_("Zero fare"),
		)
	result = booking.confirm_booking(via_credit=True)
	frappe.db.commit()
	return result

