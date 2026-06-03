# Portal list / save helpers for the Bilan admin UI

import frappe
from frappe import _
from frappe.utils import add_to_date, cint, now

from bilan_sky.bilan_air_booking_system.utils.airports import (
	enrich_route_airport_labels,
	format_route_label,
)
from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff


def _paginated(doctype, fields, filters=None, or_filters=None, order_by="modified desc", limit=50, offset=0):
	require_portal_staff()
	filters = filters or {}
	total = frappe.db.count(doctype, filters=filters)
	data = frappe.get_all(
		doctype,
		filters=filters,
		or_filters=or_filters,
		fields=fields,
		order_by=order_by,
		limit_page_length=int(limit),
		limit_start=int(offset),
	)
	return {"data": data, "total": total}


@frappe.whitelist()
def list_flight_schedules(limit=50, offset=0, status=None, search=None):
	filters = {}
	if status:
		filters["status"] = status

	or_filters = None
	if search:
		or_filters = {
			"flight_number": ["like", f"%{search}%"],
			"name": ["like", f"%{search}%"],
		}

	result = _paginated(
		"Flight Schedule",
		[
			"name",
			"flight_number",
			"route",
			"airplane",
			"departure_date",
			"departure_time",
			"arrival_date",
			"arrival_time",
			"status",
		],
		filters=filters,
		or_filters=or_filters,
		limit=limit,
		offset=offset,
	)
	route_names = {row["route"] for row in result["data"] if row.get("route")}
	route_labels = {}
	if route_names:
		for route_row in frappe.get_all(
			"Flight Route",
			filters={"name": ["in", list(route_names)]},
			fields=["name", "origin_airport", "destination_airport"],
		):
			route_labels[route_row.name] = format_route_label(
				route_row.origin_airport, route_row.destination_airport
			)
	for row in result["data"]:
		row["route_label"] = route_labels.get(row.get("route")) or row.get("route")
	return result


@frappe.whitelist()
def get_flight_schedule(schedule_name):
	"""Full schedule fields for portal amend/edit dialogs."""
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
		normalize_base_fares,
		resolve_base_fares,
	)

	doc = frappe.get_doc("Flight Schedule", schedule_name)
	route = frappe.get_doc("Flight Route", doc.route, ignore_permissions=True)
	route_fares = normalize_base_fares(route.base_fares, legacy_adult=route.base_fare)
	effective_fares = resolve_base_fares(doc, route)
	return {
		"name": doc.name,
		"flight_number": doc.flight_number,
		"route": doc.route,
		"airplane": doc.airplane,
		"departure_date": str(doc.departure_date) if doc.departure_date else None,
		"departure_time": doc.departure_time,
		"arrival_date": str(doc.arrival_date) if doc.arrival_date else None,
		"arrival_time": doc.arrival_time,
		"status": doc.status,
		"captain": doc.captain,
		"first_officer": doc.first_officer or "",
		"route_base_fares": route_fares,
		"base_fares": effective_fares,
		"base_fares_override": doc.base_fares_override,
		"base_fare_override": doc.base_fare_override,
		"docstatus": doc.docstatus,
	}


@frappe.whitelist()
def save_flight_schedule(data, submit=1):
	"""Create or update a flight schedule. Submits by default so it is bookable on the public site."""
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import apply_schedule_fare_override

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Flight Schedule", name)
		updates = {k: v for k, v in data.items() if k != "name"}
		if "base_fares_override" in updates:
			apply_schedule_fare_override(doc, updates.pop("base_fares_override"))
		elif "base_fare_override" in updates:
			raw = updates.pop("base_fare_override")
			apply_schedule_fare_override(
				doc,
				{"adult": raw} if raw not in (None, "") else None,
			)
		doc.update(updates)
	else:
		create_data = {k: v for k, v in data.items() if k != "name"}
		override = create_data.pop("base_fares_override", None)
		legacy_override = create_data.pop("base_fare_override", None)
		doc = frappe.get_doc({"doctype": "Flight Schedule", **create_data})
		if override is not None:
			apply_schedule_fare_override(doc, override)
		elif legacy_override not in (None, ""):
			apply_schedule_fare_override(doc, {"adult": legacy_override})

	doc.save()
	seats_created = doc.generate_seat_inventory()

	submitted = False
	if cint(submit) and doc.docstatus == 0:
		doc.submit()
		submitted = True

	frappe.db.commit()
	result = doc.as_dict()
	result["seats_created"] = seats_created
	result["submitted"] = submitted
	return result


def _schedule_active_booking_count(schedule_name):
	return frappe.db.count(
		"Air Booking",
		{
			"flight_schedule": schedule_name,
			"booking_status": ["not in", ["Cancelled", "Refunded"]],
			"docstatus": ["<", 2],
		},
	)


@frappe.whitelist()
def cancel_flight_schedule(schedule_name, cancel_reason=None):
	"""Cancel a flight schedule (Frappe cancel + status Cancelled)."""
	require_portal_staff()
	reason = (cancel_reason or "").strip()
	if not reason:
		frappe.throw(_("A cancellation reason is required."))

	doc = frappe.get_doc("Flight Schedule", schedule_name)
	doc.check_permission("cancel")

	if doc.status == "Cancelled" and doc.docstatus == 2:
		frappe.throw(_("This flight schedule is already cancelled."))

	if doc.status in ("Departed", "Arrived"):
		frappe.throw(_("Cannot cancel a flight that has already departed or arrived."))

	active = _schedule_active_booking_count(schedule_name)
	if active:
		frappe.throw(
			_(
				"Cannot cancel: {0} active booking(s) are linked to this schedule. Cancel those bookings first."
			).format(active)
		)

	if doc.docstatus == 1:
		doc.cancel()
		frappe.db.set_value(
			"Flight Schedule",
			schedule_name,
			"status",
			"Cancelled",
			update_modified=True,
		)
	elif doc.docstatus == 0:
		doc.status = "Cancelled"
		doc.save()
	else:
		frappe.throw(_("This flight schedule cannot be cancelled."))

	frappe.db.commit()
	return {
		"name": schedule_name,
		"status": "Cancelled",
		"docstatus": frappe.db.get_value("Flight Schedule", schedule_name, "docstatus"),
		"cancel_reason": reason,
	}


@frappe.whitelist()
def amend_flight_schedule(schedule_name, data, submit=1):
	"""Create a new submitted schedule amended from a cancelled one."""
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	cancelled = frappe.get_doc("Flight Schedule", schedule_name)
	cancelled.check_permission("read")

	if cancelled.status != "Cancelled":
		frappe.throw(_("Only cancelled flight schedules can be amended."))
	if cancelled.docstatus == 1:
		frappe.throw(_("Cancel the flight schedule before amending it."))

	amended = frappe.copy_doc(cancelled)
	amended.docstatus = 0
	amended.amended_from = cancelled.name
	amended.status = "Scheduled"
	amended.name = None
	amended.flight_number = None

	allowed = {
		"route",
		"airplane",
		"departure_date",
		"departure_time",
		"arrival_date",
		"arrival_time",
		"captain",
		"first_officer",
		"base_fare_override",
		"base_fares_override",
	}
	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import apply_schedule_fare_override

	for key, value in data.items():
		if key == "base_fares_override":
			apply_schedule_fare_override(amended, value)
		elif key in allowed and value not in (None, ""):
			amended.set(key, value)

	amended.insert()
	seats_created = amended.generate_seat_inventory()

	submitted = False
	if cint(submit) and amended.docstatus == 0:
		amended.submit()
		submitted = True

	frappe.db.commit()
	result = amended.as_dict()
	result["seats_created"] = seats_created
	result["submitted"] = submitted
	return result


@frappe.whitelist()
def ensure_schedule_seats(schedule_name):
	"""Create seat inventory for a schedule if missing (e.g. legacy schedules)."""
	require_portal_staff()
	doc = frappe.get_doc("Flight Schedule", schedule_name)
	doc.check_permission("write")
	before = frappe.db.count("Seat Inventory", {"flight_schedule": doc.name})
	created = doc.generate_seat_inventory()
	frappe.db.commit()
	return {
		"schedule": doc.name,
		"seats_before": before,
		"seats_created": created,
		"seats_total": frappe.db.count("Seat Inventory", {"flight_schedule": doc.name}),
	}


@frappe.whitelist()
def search_bookings_for_checkin(query=None, limit=15):
	"""Typeahead for portal check-in: PNR, payer name, phone, or email."""
	require_portal_staff()
	limit = int(limit or 15)
	q = (query or "").strip()

	filters = {"booking_status": ["!=", "Cancelled"]}
	fields = [
		"name",
		"flight_schedule",
		"payer_name",
		"payer_phone",
		"payer_email",
		"booking_status",
		"payment_status",
		"total_fare",
		"booking_date",
	]

	if q:
		bookings = frappe.get_all(
			"Air Booking",
			filters=filters,
			or_filters=[
				["name", "like", f"%{q}%"],
				["payer_name", "like", f"%{q}%"],
				["payer_phone", "like", f"%{q}%"],
				["payer_email", "like", f"%{q}%"],
			],
			fields=fields,
			order_by="booking_date desc",
			limit_page_length=limit,
		)
	else:
		bookings = frappe.get_all(
			"Air Booking",
			filters=filters,
			fields=fields,
			order_by="booking_date desc",
			limit_page_length=limit,
		)

	results = []
	for row in bookings:
		departure = frappe.db.get_value(
			"Flight Schedule",
			row.flight_schedule,
			["departure_date", "departure_time", "flight_number"],
			as_dict=True,
		)
		results.append(
			{
				"pnr": row.name,
				"payer_name": row.payer_name,
				"payer_phone": row.payer_phone,
				"payer_email": row.payer_email,
				"flight_schedule": row.flight_schedule,
				"flight_number": (departure or {}).get("flight_number") or row.flight_schedule,
				"departure_date": (departure or {}).get("departure_date"),
				"departure_time": (departure or {}).get("departure_time"),
				"booking_status": row.booking_status,
				"payment_status": row.payment_status,
			}
		)

	return results


@frappe.whitelist()
def list_air_bookings(limit=50, offset=0, status=None, search=None):
	filters = {}
	if status:
		filters["booking_status"] = status

	or_filters = None
	if search:
		or_filters = {
			"name": ["like", f"%{search}%"],
			"payer_name": ["like", f"%{search}%"],
			"payer_phone": ["like", f"%{search}%"],
		}

	return _paginated(
		"Air Booking",
		[
			"name",
			"flight_schedule",
			"payer_name",
			"payer_email",
			"payer_phone",
			"booking_status",
			"payment_status",
			"total_fare",
			"booking_date",
		],
		filters=filters,
		or_filters=or_filters,
		order_by="booking_date desc",
		limit=limit,
		offset=offset,
	)


@frappe.whitelist()
def list_passengers(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		or_filters = {
			"full_name": ["like", f"%{search}%"],
			"id_number": ["like", f"%{search}%"],
			"phone_number": ["like", f"%{search}%"],
		}

	return _paginated(
		"Passenger",
		[
			"name",
			"full_name",
			"id_number",
			"date_of_birth",
			"phone_number",
			"email",
			"passenger_type",
			"nationality",
			"is_active",
			"notes",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
	)


@frappe.whitelist()
def save_flight_route(data):
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Flight Route", name)
		doc.update({k: v for k, v in data.items() if k != "name"})
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Flight Route", **{k: v for k, v in data.items() if k != "name"}})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_fare_rules(limit=50, offset=0, route=None, search=None, active_only=None):
	"""List fare rules for the portal pricing screen."""
	filters = {}
	if route:
		filters["route"] = route
	if active_only in (1, "1", True, "true"):
		filters["is_active"] = 1

	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"name": ["like", q],
			"route": ["like", q],
		}

	result = _paginated(
		"Fare Rule",
		[
			"name",
			"route",
			"days_before_departure",
			"price_increase_percentage",
			"is_active",
			"priority",
			"modified",
		],
		filters=filters,
		or_filters=or_filters,
		order_by="route asc, days_before_departure asc, priority asc",
		limit=limit,
		offset=offset,
	)

	route_names = {row["route"] for row in result["data"] if row.get("route")}
	route_meta = {}
	if route_names:
		for route_row in frappe.get_all(
			"Flight Route",
			filters={"name": ["in", list(route_names)]},
			fields=["name", "route_name", "origin_airport", "destination_airport"],
		):
			route_meta[route_row.name] = route_row

	for row in result["data"]:
		meta = route_meta.get(row.get("route")) or {}
		row["route_name"] = meta.get("route_name") or row.get("route")
		row["origin_airport"] = meta.get("origin_airport")
		row["destination_airport"] = meta.get("destination_airport")
		enrich_route_airport_labels(row)

	return result


@frappe.whitelist()
def save_fare_rule(data):
	"""Create or update a fare rule from the portal."""
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Fare Rule", name)
		doc.check_permission("write")
		doc.update(data)
	else:
		doc = frappe.get_doc({"doctype": "Fare Rule", **data})
		doc.check_permission("create")

	doc.save()
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def delete_fare_rule(name):
	"""Delete a fare rule from the portal."""
	require_portal_staff()
	if not name or not frappe.db.exists("Fare Rule", name):
		frappe.throw(_("Fare rule not found"))

	doc = frappe.get_doc("Fare Rule", name)
	doc.check_permission("delete")
	doc.delete()
	frappe.db.commit()
	return {"success": True, "name": name}


@frappe.whitelist()
def list_countries():
	require_portal_staff()
	return frappe.get_all("Country", fields=["name"], order_by="name asc", limit_page_length=0)


@frappe.whitelist()
def list_crew_members(crew_role=None, for_date=None):
	"""Active crew; optionally filter by role and exclude members assigned on for_date."""
	require_portal_staff()
	if crew_role and for_date:
		from bilan_sky.bilan_air_booking_system.api.crew import fetch_available_crew_members

		return fetch_available_crew_members(crew_role, for_date)

	filters = {"status": "Active"}
	if crew_role:
		filters["crew_role"] = crew_role

	return frappe.get_all(
		"Crew Member",
		filters=filters,
		fields=["name", "full_name", "crew_role", "employee_id"],
		order_by="full_name asc",
	)


@frappe.whitelist()
def list_crew_roles(category=None):
	require_portal_staff()
	filters = {"is_active": 1}
	if category:
		filters["category"] = category
	return frappe.get_all(
		"Crew Role",
		filters=filters,
		fields=["name", "role_name", "category"],
		order_by="role_name asc",
	)


@frappe.whitelist(allow_guest=True)
def get_display_currency(doc_currency=None):
	"""Default currency + symbol for frontend (company when doc has no currency)."""
	from bilan_sky.bilan_air_booking_system.utils.currency import get_currency_display

	return get_currency_display(doc_currency)


@frappe.whitelist()
def get_print_formats(doctype):
	"""Print format names for Frappe printview."""
	require_portal_staff()
	if not doctype:
		return ["Standard"]

	formats = frappe.get_all(
		"Print Format",
		filters={"doc_type": doctype, "disabled": 0},
		pluck="name",
		order_by="name",
	)
	return formats or ["Standard"]


@frappe.whitelist()
def get_portal_user_profile():
	"""Current session user for portal profile UI."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)
	require_portal_staff()

	user = frappe.get_doc("User", frappe.session.user)
	return {
		"name": user.name,
		"full_name": user.full_name,
		"first_name": user.first_name or "",
		"last_name": user.last_name or "",
		"email": user.email or "",
		"user_image": user.user_image or "",
		"phone": user.phone or "",
		"mobile_no": user.mobile_no or "",
		"roles": [r.role for r in user.roles],
	}


@frappe.whitelist()
def update_portal_user_profile(data):
	"""Update editable User fields for the logged-in portal user."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)
	require_portal_staff()

	if isinstance(data, str):
		import json

		data = json.loads(data)

	user = frappe.get_doc("User", frappe.session.user)
	for field in ("first_name", "last_name", "phone", "mobile_no"):
		if field in data:
			user.set(field, data[field])

	user.save(ignore_permissions=True)
	frappe.db.commit()
	return get_portal_user_profile()


@frappe.whitelist()
def set_portal_user_image(user_image):
	"""Set profile picture URL after upload_file."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)
	require_portal_staff()

	if not user_image:
		frappe.throw(_("Image URL is required"))

	user = frappe.get_doc("User", frappe.session.user)
	user.user_image = user_image
	user.save(ignore_permissions=True)
	frappe.db.commit()
	return get_portal_user_profile()


def _resolve_flight_schedule_name(schedule_name):
	"""Accept schedule document name or flight number (e.g. KQ107)."""
	key = (schedule_name or "").strip()
	if not key:
		return None
	if frappe.db.exists("Flight Schedule", key):
		return key
	match = frappe.db.get_value(
		"Flight Schedule",
		{"flight_number": key},
		"name",
		order_by="departure_date desc",
	)
	return match


def _seat_inventory_row(seat):
	class_name = seat.seat_class
	if frappe.db.exists("Seat Class", seat.seat_class):
		class_name = frappe.db.get_value("Seat Class", seat.seat_class, "class_name") or seat.seat_class

	return {
		"name": seat.name,
		"seat_number": seat.seat_number,
		"seat_class": seat.seat_class,
		"seat_class_name": class_name,
		"status": seat.status,
		"booking_reference": seat.booking_reference,
		"hold_expiry": seat.hold_expiry,
	}


@frappe.whitelist()
def get_schedule_seat_inventory(schedule_name):
	"""Full seat map + stats for portal agents."""
	require_portal_staff()
	schedule_name = _resolve_flight_schedule_name(schedule_name)
	if not schedule_name:
		frappe.throw(_("Flight schedule not found"))

	doc = frappe.get_doc("Flight Schedule", schedule_name)
	doc.check_permission("read")

	route = frappe.get_doc("Flight Route", doc.route)
	expected_numbers = set(doc.expected_seat_numbers())
	existing_numbers = set(
		frappe.get_all(
			"Seat Inventory",
			filters={"flight_schedule": schedule_name},
			pluck="seat_number",
		)
	)
	missing_numbers = sorted(expected_numbers - existing_numbers, key=_seat_number_sort_key)

	seats = frappe.get_all(
		"Seat Inventory",
		filters={"flight_schedule": schedule_name},
		fields=[
			"name",
			"seat_number",
			"seat_class",
			"status",
			"booking_reference",
			"hold_expiry",
		],
		order_by="seat_number asc",
	)

	stats = {"Available": 0, "Hold": 0, "Booked": 0, "Occupied": 0, "Reserved": 0}
	by_class = {}
	rows = []

	for seat in seats:
		row = dict(seat)
		class_name = seat.seat_class
		if frappe.db.exists("Seat Class", seat.seat_class):
			class_name = frappe.db.get_value("Seat Class", seat.seat_class, "class_name") or class_name
		row["seat_class_name"] = class_name
		stats[seat.status] = stats.get(seat.status, 0) + 1
		by_class.setdefault(class_name, []).append(row)
		rows.append(row)

	return {
		"schedule": {
			"name": doc.name,
			"flight_number": doc.flight_number,
			"route": doc.route,
			"airplane": doc.airplane,
			"departure_date": str(doc.departure_date),
			"departure_time": doc.departure_time,
			"status": doc.status,
			"origin": route.origin_airport,
			"destination": route.destination_airport,
		},
		"expected_seats": len(expected_numbers),
		"total_seats": len(seats),
		"missing_seats": len(missing_numbers),
		"missing_seat_numbers": missing_numbers[:100],
		"stats": stats,
		"seats_by_class": by_class,
		"seats": rows,
	}


def _seat_number_sort_key(seat_number):
	digits = "".join(ch for ch in seat_number if ch.isdigit())
	letters = "".join(ch for ch in seat_number if not ch.isdigit())
	return (int(digits) if digits else 0, letters)


@frappe.whitelist()
def portal_hold_seat(seat_name, booking_reference=None):
	"""Put a seat on hold for a booking PNR or as an agent hold."""
	require_portal_staff()
	if not seat_name or not frappe.db.exists("Seat Inventory", seat_name):
		frappe.throw(_("Seat not found"))

	seat = frappe.get_doc("Seat Inventory", seat_name)
	seat.check_permission("write")

	booking_reference = (booking_reference or "").strip() or None

	if booking_reference:
		if not frappe.db.exists("Air Booking", booking_reference):
			frappe.throw(_("Booking {0} not found").format(booking_reference))
		booking = frappe.get_doc("Air Booking", booking_reference)
		if booking.flight_schedule != seat.flight_schedule:
			frappe.throw(_("Booking {0} is not on this flight").format(booking_reference))
		result = seat.reserve(booking_reference)
		if not result.get("success"):
			frappe.throw(result.get("message"))
	else:
		if not seat.is_available():
			frappe.throw(_("Seat {0} is not available ({1})").format(seat.seat_number, seat.status))
		settings = frappe.get_single("BA Settings")
		hold_minutes = int(settings.hold_duration or 15)
		seat.status = "Hold"
		seat.booking_reference = None
		seat.hold_expiry = add_to_date(now(), minutes=hold_minutes)
		seat.save()

	frappe.db.commit()
	return _seat_inventory_row(frappe.get_doc("Seat Inventory", seat_name))


@frappe.whitelist()
def portal_release_seat(seat_name):
	"""Release a held seat back to available (agent action)."""
	require_portal_staff()
	if not seat_name or not frappe.db.exists("Seat Inventory", seat_name):
		frappe.throw(_("Seat not found"))

	seat = frappe.get_doc("Seat Inventory", seat_name)
	seat.check_permission("write")

	if seat.status in ("Booked", "Occupied"):
		frappe.throw(
			_("Seat {0} is {1}. Cancel or change the booking instead of releasing here.").format(
				seat.seat_number, seat.status
			)
		)

	if seat.status == "Available":
		frappe.throw(_("Seat {0} is already available").format(seat.seat_number))

	seat.status = "Available"
	seat.booking_reference = None
	seat.hold_expiry = None
	seat.save()
	frappe.db.commit()

	return _seat_inventory_row(seat)


@frappe.whitelist()
def get_dashboard_stats():
	require_portal_staff()
	return {
		"total_bookings": frappe.db.count("Air Booking"),
		"pending_payments": frappe.db.count("Air Booking", {"payment_status": "Pending"}),
		"upcoming_flights": frappe.db.count(
			"Flight Schedule",
			{"status": ["in", ["Scheduled", "Boarding", "Delayed"]]},
		),
		"available_seats": frappe.db.count("Seat Inventory", {"status": "Available"}),
	}


@frappe.whitelist()
def list_payment_bookings(limit=50, offset=0):
	"""Bookings with payment / invoice context for the payments page."""
	result = list_air_bookings(limit=limit, offset=offset)
	for row in result["data"]:
		row["payment_entry"] = frappe.db.get_value("Air Booking", row["name"], "payment_entry")
		links = frappe.get_all(
			"Air Booking Invoice Link",
			filters={"parent": row["name"]},
			fields=["invoice", "invoice_type"],
			order_by="idx asc",
		)
		for link in links:
			if link.invoice:
				row["sales_invoice"] = link.invoice
				row["invoice_type"] = link.invoice_type
				break
	return result


@frappe.whitelist()
def list_booking_invoices(limit=50, offset=0, search=None):
	"""Sales invoices linked to air bookings."""
	require_portal_staff()
	limit = int(limit)
	offset = int(offset)
	search = (search or "").strip()

	from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

	conditions = ["link.invoice IS NOT NULL", "link.invoice != ''"]
	params = {"limit": limit, "offset": offset}

	if search:
		like = f"%{search}%"
		if is_remote_accounting_enabled():
			conditions.append(
				"""(
				link.invoice LIKE %(search)s
				OR link.parent LIKE %(search)s
				OR ab.payer_name LIKE %(search)s
			)"""
			)
		else:
			conditions.append(
				"""(
				link.invoice LIKE %(search)s
				OR link.parent LIKE %(search)s
				OR ab.payer_name LIKE %(search)s
				OR si.customer LIKE %(search)s
			)"""
			)
		params["search"] = like

	where = " AND ".join(conditions)
	join_si = "" if is_remote_accounting_enabled() else "LEFT JOIN `tabSales Invoice` si ON si.name = link.invoice"
	si_select = (
		"NULL AS customer, NULL AS posting_date, NULL AS due_date, "
		"NULL AS grand_total, NULL AS outstanding_amount, NULL AS invoice_status, "
		"NULL AS currency, NULL AS docstatus"
		if is_remote_accounting_enabled()
		else """si.customer,
			si.posting_date,
			si.due_date,
			si.grand_total,
			si.outstanding_amount,
			si.status AS invoice_status,
			si.currency,
			si.docstatus"""
	)
	order_by = "link.modified DESC" if is_remote_accounting_enabled() else "si.modified DESC, link.modified DESC"

	rows = frappe.db.sql(
		f"""
		SELECT
			link.invoice AS name,
			link.invoice_type,
			link.parent AS booking_pnr,
			ab.payer_name,
			ab.payment_status,
			ab.booking_status,
			ab.payment_entry,
			{si_select}
		FROM `tabAir Booking Invoice Link` link
		INNER JOIN `tabAir Booking` ab ON ab.name = link.parent
		{join_si}
		WHERE {where}
		ORDER BY {order_by}
		LIMIT %(limit)s OFFSET %(offset)s
		""",
		params,
		as_dict=True,
	)

	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import fetch_remote_sales_invoice

		for row in rows:
			remote = fetch_remote_sales_invoice(row.name)
			if remote:
				row.update(
					{
						"customer": remote.get("customer"),
						"posting_date": remote.get("posting_date"),
						"due_date": remote.get("due_date"),
						"grand_total": remote.get("grand_total"),
						"outstanding_amount": remote.get("outstanding_amount"),
						"invoice_status": remote.get("status"),
						"currency": remote.get("currency"),
						"docstatus": remote.get("docstatus"),
					}
				)

	count = frappe.db.sql(
		f"""
		SELECT COUNT(*) AS cnt
		FROM `tabAir Booking Invoice Link` link
		INNER JOIN `tabAir Booking` ab ON ab.name = link.parent
		{join_si}
		WHERE {where}
		""",
		{k: v for k, v in params.items() if k not in ("limit", "offset")},
	)[0][0]

	return {"data": rows, "total": count}


@frappe.whitelist()
def get_booking_invoice_detail(invoice_name):
	"""Sales Invoice with linked air booking context."""
	require_portal_staff()
	if not invoice_name:
		frappe.throw(_("Invoice not found"))

	from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import fetch_remote_sales_invoice

		invoice = fetch_remote_sales_invoice(invoice_name)
		if not invoice:
			frappe.throw(_("Invoice not found on the accounting site"))
	else:
		if not frappe.db.exists("Sales Invoice", invoice_name):
			frappe.throw(_("Invoice not found"))
		local = frappe.get_doc("Sales Invoice", invoice_name)
		local.check_permission("read")
		invoice = {
			"name": local.name,
			"customer": local.customer,
			"posting_date": local.posting_date,
			"due_date": local.due_date,
			"grand_total": local.grand_total,
			"outstanding_amount": local.outstanding_amount,
			"status": local.status,
			"currency": local.currency,
			"docstatus": local.docstatus,
			"remarks": local.remarks,
		}

	link = frappe.db.get_value(
		"Air Booking Invoice Link",
		{"invoice": invoice_name},
		["parent", "invoice_type"],
		as_dict=True,
	)

	booking = None
	if link and link.parent:
		booking = frappe.db.get_value(
			"Air Booking",
			link.parent,
			[
				"name",
				"payer_name",
				"payer_email",
				"payer_phone",
				"payment_status",
				"booking_status",
				"total_fare",
				"payment_entry",
				"flight_schedule",
			],
			as_dict=True,
		)

	return {
		"name": invoice.get("name"),
		"invoice_type": link.invoice_type if link else None,
		"booking_pnr": link.parent if link else None,
		"customer": invoice.get("customer"),
		"posting_date": invoice.get("posting_date"),
		"due_date": invoice.get("due_date"),
		"grand_total": invoice.get("grand_total"),
		"outstanding_amount": invoice.get("outstanding_amount"),
		"status": invoice.get("status"),
		"currency": invoice.get("currency"),
		"docstatus": invoice.get("docstatus"),
		"remarks": invoice.get("remarks"),
		"booking": booking,
	}
