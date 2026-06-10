# Portal list / save helpers for the Bilan admin UI

import frappe
from frappe import _
from frappe.utils import add_to_date, cint, flt, now

from bilan_sky.bilan_air_booking_system.utils.airports import (
	enrich_route_airport_labels,
	format_route_label,
)
from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff
from bilan_sky.bilan_air_booking_system.utils.reservation_status import VOID


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
def list_flight_schedules(limit=50, offset=0, status=None, upcoming=None, search=None):
	filters = {}
	if frappe.utils.cint(upcoming):
		filters["status"] = ["in", ["Scheduled", "Boarding", "Delayed"]]
	elif status:
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
		resolve_base_fares,
		route_fares_for_api,
		schedule_fare_override_for_api,
	)

	doc = frappe.get_doc("Flight Schedule", schedule_name)
	route = frappe.get_doc("Flight Route", doc.route, ignore_permissions=True)
	route_fares = route_fares_for_api(route)["base_fares"]
	effective_fares = resolve_base_fares(doc, route)
	result = {
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
		"docstatus": doc.docstatus,
	}
	result.update(schedule_fare_override_for_api(doc))
	result["fare_history"] = [
		{
			"changed_at": str(row.changed_at) if row.changed_at else None,
			"changed_by": row.changed_by,
			"previous_adult": row.previous_adult,
			"previous_child": row.previous_child,
			"previous_infant": row.previous_infant,
		}
		for row in sorted(
			doc.get("fare_history") or [],
			key=lambda r: r.changed_at or "",
			reverse=True,
		)
	]
	return result


@frappe.whitelist()
def delete_flight_schedule(schedule_name):
	"""Permanently delete a cancelled flight schedule."""
	require_portal_staff()
	doc = frappe.get_doc("Flight Schedule", schedule_name)
	doc.check_permission("delete")

	if doc.status != "Cancelled":
		frappe.throw(_("Only cancelled flight schedules can be deleted."))

	if doc.docstatus == 1:
		frappe.throw(_("Cancel the flight schedule before deleting it."))

	active = _schedule_active_booking_count(schedule_name)
	if active:
		frappe.throw(
			_(
				"Cannot delete: {0} active booking(s) are linked to this schedule. Cancel those bookings first."
			).format(active)
		)

	frappe.delete_doc("Flight Schedule", schedule_name, force=True)
	frappe.db.commit()
	return {"deleted": schedule_name}


@frappe.whitelist()
def save_flight_schedule(data, submit=1):
	"""Create or update a flight schedule. Submits by default so it is bookable on the public site."""
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
		normalize_schedule_override_payload,
		pop_and_apply_schedule_overrides,
	)

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Flight Schedule", name)
		# Fare history is system-managed on save; never accept client rows.
		updates = {k: v for k, v in data.items() if k not in ("name", "fare_history")}
		pop_and_apply_schedule_overrides(doc, updates)
		normalize_schedule_override_payload(updates)
		doc.update(updates)
	else:
		create_data = {k: v for k, v in data.items() if k != "name"}
		normalize_schedule_override_payload(create_data)
		doc = frappe.get_doc({"doctype": "Flight Schedule", **create_data})

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
			"reservation_status": ["!=", "Void"],
			"docstatus": ["<", 2],
		},
	)


def _active_bookings_for_schedule(schedule_name):
	return frappe.get_all(
		"Air Booking",
		filters={
			"flight_schedule": schedule_name,
			"reservation_status": ["!=", "Void"],
			"docstatus": ["<", 2],
		},
		fields=["name", "pnr", "payment_status", "total_fare", "payer_name"],
		order_by="modified desc",
	)


@frappe.whitelist()
def get_schedule_cancellation_preview(schedule_name):
	"""Paid/unpaid bookings on a schedule before cancellation."""
	require_portal_staff()
	rows = _active_bookings_for_schedule(schedule_name)
	paid = [row for row in rows if row.payment_status == "Paid"]
	unpaid = [row for row in rows if row.payment_status != "Paid"]
	return {
		"active_bookings_count": len(rows),
		"paid_bookings_count": len(paid),
		"unpaid_bookings_count": len(unpaid),
		"paid_bookings": paid,
		"total_paid_fare": sum(flt(row.total_fare) for row in paid),
	}


@frappe.whitelist()
def cancel_flight_schedule(
	schedule_name,
	cancel_reason=None,
	refund_type=None,
	refund_amount=None,
):
	"""Cancel a flight schedule, void linked bookings, and refund paid ones."""
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

	active_rows = _active_bookings_for_schedule(schedule_name)
	paid_rows = [row for row in active_rows if row.payment_status == "Paid"]
	unpaid_rows = [row for row in active_rows if row.payment_status != "Paid"]

	if paid_rows:
		refund_type = (refund_type or "").strip().lower()
		if refund_type not in ("full", "partial"):
			frappe.throw(
				_("Choose full or partial refund for {0} paid booking(s).").format(len(paid_rows))
			)
		if refund_type == "partial" and flt(refund_amount) <= 0:
			frappe.throw(_("Enter a refund amount per booking for a partial refund."))

	refunds = []
	for row in paid_rows:
		booking = frappe.get_doc("Air Booking", row.name)
		booking.check_permission("write")
		refund_result = booking.process_refund(
			refund_type=refund_type,
			refund_amount=refund_amount,
		)
		if refund_result:
			refunds.append(
				{
					"booking": booking.name,
					"pnr": booking.pnr,
					**refund_result,
				}
			)
		booking.cancel_booking(reason_for_cancel=reason)

	for row in unpaid_rows:
		booking = frappe.get_doc("Air Booking", row.name)
		booking.check_permission("write")
		booking.cancel_booking(reason_for_cancel=reason)

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
		"bookings_cancelled": len(active_rows),
		"refunds": refunds,
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
		"base_fare_adult_override",
		"base_fare_child_override",
		"base_fare_infant_override",
	}
	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
		normalize_schedule_override_payload,
		pop_and_apply_schedule_overrides,
	)

	pop_and_apply_schedule_overrides(amended, data)
	normalize_schedule_override_payload(data)
	for key, value in data.items():
		if key in allowed:
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
	"""Typeahead for portal check-in: reservation ref, PNR, payer name, phone, or email."""
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.reservation_status import resolve_air_booking

	limit = int(limit or 15)
	q = (query or "").strip()

	filters = {"reservation_status": ["!=", "Void"]}
	fields = [
		"name",
		"pnr",
		"flight_schedule",
		"payer_name",
		"payer_phone",
		"payer_email",
		"reservation_status",
		"payment_status",
		"total_fare",
		"booking_date",
	]

	if q:
		bookings = []
		seen = set()
		exact_name = resolve_air_booking(q, throw=False)
		if exact_name:
			exact_row = frappe.db.get_value("Air Booking", exact_name, fields, as_dict=True)
			if exact_row and exact_row.get("reservation_status") != "Void":
				bookings.append(exact_row)
				seen.add(exact_name)

		for row in frappe.get_all(
			"Air Booking",
			filters=filters,
			or_filters=[
				["name", "like", f"%{q}%"],
				["pnr", "like", f"%{q}%"],
				["payer_name", "like", f"%{q}%"],
				["payer_phone", "like", f"%{q}%"],
				["payer_email", "like", f"%{q}%"],
			],
			fields=fields,
			order_by="booking_date desc",
			limit_page_length=limit,
		):
			if row.name not in seen:
				bookings.append(row)
				seen.add(row.name)
			if len(bookings) >= limit:
				break
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
				"pnr": row.pnr or None,
				"reservation_ref": row.name,
				"public_reference": row.pnr or row.name,
				"payer_name": row.payer_name,
				"payer_phone": row.payer_phone,
				"payer_email": row.payer_email,
				"flight_schedule": row.flight_schedule,
				"flight_number": (departure or {}).get("flight_number") or row.flight_schedule,
				"departure_date": (departure or {}).get("departure_date"),
				"departure_time": (departure or {}).get("departure_time"),
				"reservation_status": row.reservation_status,
				"booking_status": row.reservation_status,
				"payment_status": row.payment_status,
			}
		)

	return results


@frappe.whitelist()
def list_air_bookings(limit=50, offset=0, status=None, payment_status=None, search=None):
	filters = {}
	if status:
		filters["reservation_status"] = status
	if payment_status:
		filters["payment_status"] = payment_status

	or_filters = None
	if search:
		from bilan_sky.bilan_air_booking_system.utils.reservation_status import resolve_air_booking

		q = str(search).strip()
		exact_name = resolve_air_booking(q, throw=False)
		if exact_name:
			filters["name"] = exact_name
		else:
			or_filters = {
				"name": ["like", f"%{q}%"],
				"pnr": ["like", f"%{q}%"],
				"payer_name": ["like", f"%{q}%"],
				"payer_phone": ["like", f"%{q}%"],
			}

	return _paginated(
		"Air Booking",
		[
			"name",
			"flight_schedule",
			"payer_name",
			"payer_email",
			"payer_phone",
			"pnr",
			"reservation_status",
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
def list_passenger_tickets(limit=50, offset=0, search=None):
	"""Issued passenger tickets from confirmed Air Bookings."""
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.reservation_status import CONFIRM

	conditions = [
		"ab.reservation_status = %(status)s",
		"IFNULL(p.ticket_number, '') != ''",
	]
	params = {
		"status": CONFIRM,
		"limit": cint(limit) or 50,
		"offset": cint(offset),
	}

	if search and str(search).strip():
		params["search"] = f"%{str(search).strip()}%"
		conditions.append(
			"(p.ticket_number LIKE %(search)s "
			"OR p.passenger_name LIKE %(search)s "
			"OR ab.pnr LIKE %(search)s "
			"OR ab.name LIKE %(search)s)"
		)

	where = " AND ".join(conditions)
	base_from = """
		FROM `tabAir Booking Passenger` p
		INNER JOIN `tabAir Booking` ab ON ab.name = p.parent
		WHERE {where}
	""".format(where=where)

	total = frappe.db.sql(
		f"SELECT COUNT(*) {base_from}",
		params,
	)[0][0]

	rows = frappe.db.sql(
		f"""
		SELECT
			p.name AS passenger_row,
			p.passenger_name,
			p.ticket_number,
			p.seat_number,
			p.passenger_type,
			ab.name AS reservation_ref,
			ab.pnr,
			ab.flight_schedule,
			ab.booking_date
		{base_from}
		ORDER BY ab.booking_date DESC, p.idx ASC
		LIMIT %(limit)s OFFSET %(offset)s
		""",
		params,
		as_dict=True,
	)

	schedule_ids = {row.flight_schedule for row in rows if row.get("flight_schedule")}
	schedule_meta = {}
	if schedule_ids:
		for schedule in frappe.get_all(
			"Flight Schedule",
			filters={"name": ["in", list(schedule_ids)]},
			fields=["name", "flight_number", "departure_date"],
		):
			schedule_meta[schedule.name] = schedule

	seat_ids = {row.seat_number for row in rows if row.get("seat_number")}
	seat_labels = {}
	if seat_ids:
		for seat in frappe.get_all(
			"Seat Inventory",
			filters={"name": ["in", list(seat_ids)]},
			fields=["name", "seat_number"],
		):
			seat_labels[seat.name] = seat.seat_number

	for row in rows:
		schedule = schedule_meta.get(row.get("flight_schedule")) or {}
		row["flight_number"] = schedule.get("flight_number")
		row["departure_date"] = str(schedule.get("departure_date") or "") or None
		row["seat_label"] = seat_labels.get(row.get("seat_number")) or row.get("seat_number")

	return {"data": rows, "total": total}


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


def _parse_route_payload(data: dict) -> tuple[dict, list | None]:
	"""Split route fields and optional route_segments child rows."""
	payload = dict(data)
	segments = payload.pop("route_segments", None)
	if segments is not None and not isinstance(segments, list):
		import json

		if isinstance(segments, str):
			segments = json.loads(segments)
	return payload, segments


@frappe.whitelist()
def get_flight_route(name):
	"""Full route record including segments for portal edit."""
	require_portal_staff()
	if not name or not frappe.db.exists("Flight Route", name):
		frappe.throw(_("Route not found"))
	from bilan_sky.bilan_air_booking_system.utils.flight_route_portal import serialize_flight_route

	doc = frappe.get_doc("Flight Route", name)
	doc.check_permission("read")
	return serialize_flight_route(doc)


@frappe.whitelist()
def save_flight_route(data):
	require_portal_staff()
	if isinstance(data, str):
		import json

		data = json.loads(data)

	from bilan_sky.bilan_air_booking_system.utils.flight_route_portal import (
		apply_route_segments_to_doc,
		serialize_flight_route,
	)

	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import normalize_route_fare_payload

	payload, segments = _parse_route_payload(data)
	normalize_route_fare_payload(payload)
	name = payload.get("name")
	skip_keys = {"name", "route_segments", "segment_count", "segments_summary", "base_fares"}

	if name:
		doc = frappe.get_doc("Flight Route", name)
		for key, value in payload.items():
			if key not in skip_keys:
				doc.set(key, value)
		if segments is not None:
			apply_route_segments_to_doc(doc, segments)
		doc.save(ignore_permissions=True)
	else:
		create_payload = {k: v for k, v in payload.items() if k not in skip_keys}
		doc = frappe.get_doc({"doctype": "Flight Route", **create_payload})
		if segments is not None:
			apply_route_segments_to_doc(doc, segments)
		doc.insert(ignore_permissions=True)

	frappe.db.commit()
	return serialize_flight_route(doc)


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
def list_crew_members(crew_role=None, for_date=None, capacity=None):
	"""Active crew; optionally filter by role, pilot capacity (captain/FO), and date availability."""
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.crew_filters import (
		crew_member_filters_for_capacity,
		pilot_crew_role_names,
		role_names_for_capacity,
	)

	if for_date:
		from bilan_sky.bilan_air_booking_system.api.crew import fetch_available_crew_members

		if crew_role:
			role_names = [crew_role]
		elif capacity:
			role_names = role_names_for_capacity(capacity)
		else:
			role_names = pilot_crew_role_names()

		allowed = set(pilot_crew_role_names())
		role_names = [r for r in role_names if r in allowed]
		seen: set[str] = set()
		rows: list[dict] = []
		for role in role_names:
			for row in fetch_available_crew_members(role, for_date):
				if row.name in seen:
					continue
				seen.add(row.name)
				rows.append(row)
		rows.sort(key=lambda r: (r.get("full_name") or r.get("name") or "").lower())
		return rows

	filters = crew_member_filters_for_capacity(capacity) if capacity else {"status": "Active"}
	if crew_role:
		allowed_pilot_roles = set(pilot_crew_role_names())
		if allowed_pilot_roles and crew_role not in allowed_pilot_roles:
			return []
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

	from bilan_sky.bilan_air_booking_system.utils.booking_agent import booking_agent_row_for_user

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
		"booking_agent_profile": booking_agent_row_for_user(user.name),
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

	stats = {"Available": 0, "Unreleased": 0, "Hold": 0, "Booked": 0, "Occupied": 0, "Reserved": 0}
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

	from bilan_sky.bilan_air_booking_system.utils.flight_segments import get_schedule_segments

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
			"total_aircraft_capacity": doc.total_aircraft_capacity or len(expected_numbers),
			"seats_released_count": doc.seats_released_count or 0,
			"initial_seats_released": doc.initial_seats_released or 0,
			"segments": get_schedule_segments(doc.name),
		},
		"expected_seats": len(expected_numbers),
		"total_seats": len(seats),
		"missing_seats": len(missing_numbers),
		"missing_seat_numbers": missing_numbers[:100],
		"stats": stats,
		"seats_by_class": by_class,
		"seats": rows,
	}


@frappe.whitelist()
def release_schedule_seats(schedule_name, count):
	"""Release additional seats for sale on a flight schedule."""
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.seat_release import release_additional_seats

	schedule_name = _resolve_flight_schedule_name(schedule_name)
	if not schedule_name:
		frappe.throw(_("Flight schedule not found"))
	return release_additional_seats(schedule_name, count)


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
		from bilan_sky.bilan_air_booking_system.utils.reservation_status import resolve_air_booking

		booking_name = resolve_air_booking(booking_reference)
		booking = frappe.get_doc("Air Booking", booking_name)
		if booking.flight_schedule != seat.flight_schedule:
			frappe.throw(_("Booking {0} is not on this flight").format(booking_reference))
		from bilan_sky.bilan_air_booking_system.utils.seat_booking import reserve_seat_for_booking

		result = reserve_seat_for_booking(
			seat_name,
			booking_name,
			flight_schedule=booking.flight_schedule,
			boarding_airport=booking.boarding_airport,
			deboarding_airport=booking.deboarding_airport,
		)
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
	"""Clear a hold and return the seat to Available."""
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

	if seat.status == "Unreleased":
		frappe.throw(
			_("Seat {0} is unreleased. Use release for sale instead.").format(seat.seat_number)
		)

	seat.status = "Available"
	seat.booking_reference = None
	seat.hold_expiry = None
	seat.save()
	frappe.db.commit()

	return _seat_inventory_row(seat)


@frappe.whitelist()
def portal_release_seat_for_sale(seat_name):
	"""Release one unreleased seat for booking."""
	require_portal_staff()
	if not seat_name or not frappe.db.exists("Seat Inventory", seat_name):
		frappe.throw(_("Seat not found"))

	seat = frappe.get_doc("Seat Inventory", seat_name)
	seat.check_permission("write")

	from bilan_sky.bilan_air_booking_system.utils.seat_release import release_single_seat_for_sale

	release_single_seat_for_sale(seat_name)
	return _seat_inventory_row(frappe.get_doc("Seat Inventory", seat_name))


@frappe.whitelist()
def portal_restrict_seat(seat_name):
	"""Restrict an empty available seat from sale (Unreleased)."""
	require_portal_staff()
	if not seat_name or not frappe.db.exists("Seat Inventory", seat_name):
		frappe.throw(_("Seat not found"))

	seat = frappe.get_doc("Seat Inventory", seat_name)
	seat.check_permission("write")

	from bilan_sky.bilan_air_booking_system.utils.seat_release import restrict_single_seat_from_sale

	restrict_single_seat_from_sale(seat_name)
	return _seat_inventory_row(frappe.get_doc("Seat Inventory", seat_name))


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


_MONTH_LABELS = (
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
)


def _booking_year_filters(year):
	from frappe.utils import getdate

	year = cint(year) or getdate().year
	year_start = f"{year}-01-01"
	year_end = f"{year + 1}-01-01"
	return {
		"year": year,
		"year_start": year_start,
		"year_end": year_end,
		"void": VOID,
	}


def _yoy_pct(current, prior):
	from frappe.utils import flt

	current = flt(current)
	prior = flt(prior)
	if not prior:
		return None
	return round((current - prior) / prior * 100, 1)


def _reports_summary_for_year(year):
	from frappe.utils import flt

	params = _booking_year_filters(year)
	booking_where = """
		docstatus < 2
		AND IFNULL(reservation_status, '') != %(void)s
		AND booking_date >= %(year_start)s
		AND booking_date < %(year_end)s
	"""
	stats = frappe.db.sql(
		f"""
		SELECT
			COUNT(*) AS total_bookings,
			COALESCE(SUM(total_fare), 0) AS total_revenue
		FROM `tabAir Booking`
		WHERE {booking_where}
		""",
		params,
		as_dict=True,
	)[0]
	total_passengers = frappe.db.sql(
		f"""
		SELECT COUNT(p.name) AS total
		FROM `tabAir Booking Passenger` p
		INNER JOIN `tabAir Booking` ab ON ab.name = p.parent
		WHERE ab.docstatus < 2
			AND IFNULL(ab.reservation_status, '') != %(void)s
			AND ab.booking_date >= %(year_start)s
			AND ab.booking_date < %(year_end)s
		""",
		params,
	)[0][0]
	flights_operated = frappe.db.count(
		"Flight Schedule",
		{
			"status": ["in", ["Departed", "Arrived"]],
			"departure_date": ["between", [params["year_start"], f"{params['year']}-12-31"]],
		},
	)
	return {
		"total_bookings": cint(stats.total_bookings),
		"total_revenue": flt(stats.total_revenue),
		"total_passengers": cint(total_passengers),
		"flights_operated": cint(flights_operated),
	}


@frappe.whitelist()
def get_portal_reports(year=None):
	"""Year-scoped aggregates for the portal reports page."""
	from frappe.utils import flt, getdate

	require_portal_staff()
	params = _booking_year_filters(year)
	year = params["year"]
	booking_where = """
		docstatus < 2
		AND IFNULL(reservation_status, '') != %(void)s
		AND booking_date >= %(year_start)s
		AND booking_date < %(year_end)s
	"""

	available_years = [
		cint(row.y)
		for row in frappe.db.sql(
			"""
			SELECT DISTINCT YEAR(booking_date) AS y
			FROM `tabAir Booking`
			WHERE booking_date IS NOT NULL AND docstatus < 2
			ORDER BY y DESC
			""",
			as_dict=True,
		)
		if row.y
	]
	if year not in available_years:
		available_years = sorted(set(available_years + [year]), reverse=True)

	summary = _reports_summary_for_year(year)
	prior = _reports_summary_for_year(year - 1)
	yoy = {
		"total_revenue": _yoy_pct(summary["total_revenue"], prior["total_revenue"]),
		"total_bookings": _yoy_pct(summary["total_bookings"], prior["total_bookings"]),
		"total_passengers": _yoy_pct(summary["total_passengers"], prior["total_passengers"]),
		"flights_operated": _yoy_pct(summary["flights_operated"], prior["flights_operated"]),
	}

	monthly_rows = {
		row.month_num: row
		for row in frappe.db.sql(
			f"""
			SELECT
				MONTH(booking_date) AS month_num,
				COUNT(*) AS bookings,
				COALESCE(SUM(total_fare), 0) AS revenue
			FROM `tabAir Booking`
			WHERE {booking_where}
			GROUP BY MONTH(booking_date)
			""",
			params,
			as_dict=True,
		)
	}
	monthly = [
		{
			"month": _MONTH_LABELS[month_num - 1],
			"month_num": month_num,
			"bookings": cint(monthly_rows[month_num].bookings) if month_num in monthly_rows else 0,
			"revenue": flt(monthly_rows[month_num].revenue) if month_num in monthly_rows else 0,
		}
		for month_num in range(1, 13)
	]

	ab_booking_where = """
		ab.docstatus < 2
		AND IFNULL(ab.reservation_status, '') != %(void)s
		AND ab.booking_date >= %(year_start)s
		AND ab.booking_date < %(year_end)s
	"""
	top_routes = []
	for row in frappe.db.sql(
		f"""
		SELECT
			fs.route,
			COUNT(ab.name) AS bookings,
			COALESCE(SUM(ab.total_fare), 0) AS revenue
		FROM `tabAir Booking` ab
		INNER JOIN `tabFlight Schedule` fs ON fs.name = ab.flight_schedule
		WHERE {ab_booking_where}
			AND IFNULL(fs.route, '') != ''
		GROUP BY fs.route
		ORDER BY revenue DESC
		LIMIT 5
		""",
		params,
		as_dict=True,
	):
		route_doc = frappe.db.get_value(
			"Flight Route",
			row.route,
			["route_name", "origin_airport", "destination_airport"],
			as_dict=True,
		)
		if route_doc:
			route_label = route_doc.route_name or format_route_label(
				route_doc.origin_airport,
				route_doc.destination_airport,
			)
		else:
			route_label = row.route
		top_routes.append(
			{
				"route": route_label,
				"bookings": cint(row.bookings),
				"revenue": flt(row.revenue),
			}
		)

	return {
		"year": year,
		"available_years": available_years,
		"summary": summary,
		"yoy": yoy,
		"monthly": monthly,
		"top_routes": top_routes,
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
			link.invoice_number,
			link.invoice_type,
			link.parent AS booking_pnr,
			ab.payer_name,
			ab.payment_status,
			ab.reservation_status,
			ab.reservation_status AS booking_status,
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
						"invoice_number": row.get("invoice_number") or remote.get("invoice_number"),
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
		["parent", "invoice_type", "invoice_number"],
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
				"reservation_status",
				"total_fare",
				"payment_entry",
				"flight_schedule",
			],
			as_dict=True,
		)

	return {
		"name": invoice.get("name"),
		"invoice_number": (link.invoice_number if link else None)
		or invoice.get("invoice_number")
		or invoice.get("name"),
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
