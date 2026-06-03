# Portal CRUD for master data and staff users

import frappe
from frappe import _

from bilan_sky.bilan_air_booking_system.api.portal import _paginated
from bilan_sky.bilan_air_booking_system.utils.airports import enrich_route_airport_labels
from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff
from bilan_sky.bilan_air_booking_system.utils.user_accounts import create_or_get_user

BOOKING_AGENT_ROLE = "Booking Agent"


def _parse_data(data):
	if isinstance(data, str):
		import json

		return json.loads(data)
	return data or {}


def _require_user_create_permission():
	require_portal_staff()
	if not frappe.has_permission("User", "create"):
		frappe.throw(_("You do not have permission to create users."), frappe.PermissionError)


@frappe.whitelist()
def list_airports(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"airport_name": ["like", q],
			"iata_code": ["like", q],
			"city": ["like", q],
			"name": ["like", q],
		}
	return _paginated(
		"Airport",
		[
			"name",
			"airport_name",
			"iata_code",
			"abbrev",
			"city",
			"country",
			"time_zone",
			"is_active",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="airport_name asc",
	)


@frappe.whitelist()
def save_airport(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	payload = {k: v for k, v in data.items() if k != "name"}
	if name:
		doc = frappe.get_doc("Airport", name)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Airport", **payload})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_airlines(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"airline_name": ["like", q],
			"iata_code": ["like", q],
			"icao_code": ["like", q],
			"name": ["like", q],
		}
	return _paginated(
		"Airline",
		[
			"name",
			"airline_name",
			"iata_code",
			"icao_code",
			"country",
			"is_active",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="airline_name asc",
	)


@frappe.whitelist()
def save_airline(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	payload = {k: v for k, v in data.items() if k != "name"}
	if name:
		doc = frappe.get_doc("Airline", name)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Airline", **payload})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_airplanes(limit=50, offset=0, search=None, status=None):
	filters = {}
	if status:
		filters["status"] = status
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"registration_number": ["like", q],
			"aircraft_model": ["like", q],
			"name": ["like", q],
		}
	return _paginated(
		"Airplane",
		[
			"name",
			"registration_number",
			"airline",
			"aircraft_model",
			"status",
			"total_seats",
		],
		filters=filters,
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="registration_number asc",
	)


@frappe.whitelist()
def get_airplane(name):
	require_portal_staff()
	doc = frappe.get_doc("Airplane", name)
	row = doc.as_dict()
	row["seat_config"] = [r.as_dict() for r in doc.seat_config or []]
	return row


@frappe.whitelist()
def save_airplane(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	seat_config = data.pop("seat_config", None)
	payload = {k: v for k, v in data.items() if k != "name"}

	if name:
		doc = frappe.get_doc("Airplane", name)
		doc.update(payload)
		if seat_config is not None:
			doc.set("seat_config", seat_config)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Airplane", **payload})
		if seat_config is not None:
			doc.set("seat_config", seat_config)
		doc.insert(ignore_permissions=True)

	frappe.db.commit()
	return get_airplane(doc.name)


@frappe.whitelist()
def list_flight_routes(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"route_name": ["like", q],
			"origin_airport": ["like", q],
			"destination_airport": ["like", q],
			"name": ["like", q],
		}
	result = _paginated(
		"Flight Route",
		[
			"name",
			"route_name",
			"origin_airport",
			"destination_airport",
			"distance_km",
			"base_fare",
			"currency",
			"airline",
			"duration",
			"is_active",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="route_name asc",
	)
	for row in result["data"]:
		enrich_route_airport_labels(row)
	return result


@frappe.whitelist()
def list_currencies():
	require_portal_staff()
	return frappe.get_all(
		"Currency",
		filters={"enabled": 1},
		fields=["name"],
		order_by="name asc",
		limit_page_length=0,
	)


@frappe.whitelist()
def list_seat_classes():
	require_portal_staff()
	return frappe.get_all(
		"Seat Class",
		filters={"is_active": 1},
		fields=["name", "class_name"],
		order_by="class_name asc",
	)


@frappe.whitelist()
def list_crew_members_portal(limit=50, offset=0, search=None, crew_role=None, status=None):
	filters = {}
	if crew_role:
		filters["crew_role"] = crew_role
	if status:
		filters["status"] = status

	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"full_name": ["like", q],
			"email": ["like", q],
			"employee_id": ["like", q],
			"name": ["like", q],
		}

	return _paginated(
		"Crew Member",
		[
			"name",
			"full_name",
			"crew_role",
			"employee_id",
			"email",
			"phone_number",
			"status",
			"base_airport",
			"license_number",
		],
		filters=filters,
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="full_name asc",
	)


@frappe.whitelist()
def get_crew_member(name):
	require_portal_staff()
	doc = frappe.get_doc("Crew Member", name)
	row = doc.as_dict()
	row["certified_aircraft"] = [r.as_dict() for r in doc.certified_aircraft or []]
	return row


@frappe.whitelist()
def save_crew_member(data):
	"""Create/update crew record without auto-creating a login user."""
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	certified_aircraft = data.pop("certified_aircraft", None)
	payload = {k: v for k, v in data.items() if k not in ("name", "user")}
	payload.pop("user", None)

	frappe.flags.skip_crew_user_creation = True
	try:
		if name:
			doc = frappe.get_doc("Crew Member", name)
			doc.update(payload)
			if certified_aircraft is not None:
				doc.set("certified_aircraft", certified_aircraft)
			doc.save(ignore_permissions=True)
		else:
			doc = frappe.get_doc({"doctype": "Crew Member", **payload})
			if certified_aircraft is not None:
				doc.set("certified_aircraft", certified_aircraft)
			doc.insert(ignore_permissions=True)
		frappe.db.commit()
		return get_crew_member(doc.name)
	finally:
		frappe.flags.skip_crew_user_creation = False


CREW_STATUSES = frozenset({"Active", "On Leave", "Training", "Inactive"})


@frappe.whitelist()
def set_crew_member_status(name, status):
	"""Set crew member status (e.g. deactivate → Inactive)."""
	require_portal_staff()
	if not name or not frappe.db.exists("Crew Member", name):
		frappe.throw(_("Crew member not found"))
	status = (status or "").strip()
	if status not in CREW_STATUSES:
		frappe.throw(_("Invalid crew status"))

	doc = frappe.get_doc("Crew Member", name)
	doc.status = status
	frappe.flags.skip_crew_user_creation = True
	try:
		doc.save(ignore_permissions=True)
	finally:
		frappe.flags.skip_crew_user_creation = False

	if doc.user:
		frappe.db.set_value("User", doc.user, "enabled", 0 if status == "Inactive" else 1)

	frappe.db.commit()
	return get_crew_member(name)


@frappe.whitelist()
def list_booking_agents(limit=50, offset=0, search=None):
	require_portal_staff()
	agent_users = frappe.get_all(
		"Has Role",
		filters={"role": BOOKING_AGENT_ROLE, "parenttype": "User"},
		pluck="parent",
	)
	if not agent_users:
		return {"data": [], "total": 0}

	users = frappe.get_all(
		"User",
		filters={"name": ["in", agent_users]},
		fields=["name", "email", "full_name", "enabled", "mobile_no", "last_login"],
		order_by="full_name asc",
	)

	if search:
		q = search.strip().lower()
		users = [
			u
			for u in users
			if q in (u.get("email") or "").lower()
			or q in (u.get("full_name") or "").lower()
			or q in (u.get("name") or "").lower()
		]

	total = len(users)
	start = int(offset or 0)
	end = start + int(limit or 50)
	return {"data": users[start:end], "total": total}


@frappe.whitelist()
def create_booking_agent(email, first_name, last_name=None, phone=None, password=None):
	"""Create a system user with the Booking Agent role."""
	_require_user_create_permission()
	email = (email or "").strip().lower()
	if not email:
		frappe.throw(_("Email is required."))
	if not (first_name or "").strip():
		frappe.throw(_("First name is required."))

	full_name = f"{first_name.strip()} {(last_name or '').strip()}".strip()
	user_name = create_or_get_user(
		email,
		full_name,
		mobile_no=phone,
		role=BOOKING_AGENT_ROLE,
		send_welcome_email=0,
		default_first_name="Agent",
	)

	if password:
		from frappe.utils.password import update_password

		update_password(user=user_name, pwd=password)

	user = frappe.get_doc("User", user_name)
	roles = [r.role for r in user.roles]
	if BOOKING_AGENT_ROLE not in roles:
		user.add_roles(BOOKING_AGENT_ROLE)

	frappe.db.commit()
	return {
		"name": user.name,
		"email": user.email,
		"full_name": user.full_name,
		"enabled": user.enabled,
		"mobile_no": user.mobile_no,
		"roles": [r.role for r in user.roles],
	}
