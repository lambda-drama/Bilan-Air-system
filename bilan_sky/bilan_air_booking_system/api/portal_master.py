# Portal CRUD for master data and staff users

import frappe
from frappe import _
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.api.portal import _paginated
from bilan_sky.bilan_air_booking_system.utils.airports import enrich_route_airport_labels
from bilan_sky.bilan_air_booking_system.utils.rich_text import rich_text_to_plain
from bilan_sky.bilan_air_booking_system.utils.agent_address import (
	create_or_update_agent_address,
	default_address_country,
)
from bilan_sky.bilan_air_booking_system.utils.booking_agent import (
	booking_agent_activation_by_email,
	create_booking_agent_profile,
	default_credit_limit,
	serialize_booking_agent,
	sync_booking_agent_user_enabled,
)
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
			"is_multi_segment",
			"distance_km",
			"base_fare_adult",
			"base_fare_child",
			"base_fare_infant",
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
	from bilan_sky.bilan_air_booking_system.utils.flight_route_portal import (
		segments_summary,
		serialize_route_segments,
	)

	for row in result["data"]:
		enrich_route_airport_labels(row)
		segments = serialize_route_segments(row["name"])
		row["segment_count"] = len(segments)
		row["segments_summary"] = segments_summary(segments)
		row["is_multi_segment"] = cint(row.get("is_multi_segment"))
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
def list_cabin_classes(active_only=1):
	require_portal_staff()
	filters = {"is_active": 1} if cint(active_only) else {}
	return frappe.get_all(
		"Cabin Class",
		filters=filters,
		fields=[
			"name",
			"cabin_name",
			"display_order",
			"color_code",
			"is_active",
			"checked_baggage_kg",
			"checked_baggage_pieces",
			"carry_on_kg",
			"carry_on_pieces",
			"excess_baggage_fee_per_kg",
			"description",
		],
		order_by="display_order asc, cabin_name asc",
		ignore_permissions=True,
	)


@frappe.whitelist()
def save_cabin_class(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	payload = {k: v for k, v in data.items() if k != "name"}
	if name:
		doc = frappe.get_doc("Cabin Class", name, ignore_permissions=True)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Cabin Class", **payload})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_seat_classes(active_only=1, layout_only=None):
	require_portal_staff()
	filters = {"is_active": 1} if cint(active_only) else {}
	if layout_only not in (None, ""):
		filters["use_on_aircraft_layout"] = cint(layout_only)
	return frappe.get_all(
		"Seat Class",
		filters=filters,
		fields=[
			"name",
			"class_name",
			"cabin_class",
			"use_on_aircraft_layout",
			"price_multiplier",
			"color_code",
			"is_active",
			"checked_baggage_kg",
			"checked_baggage_pieces",
			"carry_on_kg",
			"carry_on_pieces",
			"excess_baggage_fee_per_kg",
			"description",
		],
		order_by="class_name asc",
		ignore_permissions=True,
	)


@frappe.whitelist()
def save_seat_class(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	payload = {k: v for k, v in data.items() if k != "name"}
	if name:
		doc = frappe.get_doc("Seat Class", name, ignore_permissions=True)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Seat Class", **payload})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc.as_dict()


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
def list_booking_companies(limit=200, offset=0, search=None):
	require_portal_staff()
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"company_agency": ["like", q],
			"name": ["like", q],
		}
	result = _paginated(
		"Booking Company",
		["name", "company_agency", "is_agency"],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="company_agency asc",
	)
	for row in result["data"]:
		row["is_agency"] = cint(row.get("is_agency"))
		row["label"] = (
			f"{row['company_agency']} (Agency)" if row["is_agency"] else row["company_agency"]
		)
	return result


@frappe.whitelist()
def create_booking_company(company_agency, is_agency=0):
	require_portal_staff()
	from bilan_sky.bilan_air_booking_system.utils.booking_company import (
		create_booking_company as _create,
		serialize_booking_company,
	)

	doc = _create(company_agency, is_agency=cint(is_agency))
	frappe.db.commit()
	return serialize_booking_company(doc)


def _validate_booking_agent_contact_fields(
	*,
	booking_company=None,
	agent_name=None,
	username,
	email,
	first_name,
	last_name,
	address_line1,
	phone,
	city,
):
	if not (booking_company or "").strip() and not (agent_name or "").strip():
		frappe.throw(_("Company or agency is required."))
	if not (username or "").strip():
		frappe.throw(_("Username is required."))
	if not (email or "").strip():
		frappe.throw(_("Email is required."))
	if not (first_name or "").strip():
		frappe.throw(_("First name is required."))
	if not (last_name or "").strip():
		frappe.throw(_("Last name is required."))
	if not (address_line1 or "").strip():
		frappe.throw(_("Address line 1 is required."))
	if not (phone or "").strip():
		frappe.throw(_("Phone 1 is required."))
	if not (city or "").strip():
		frappe.throw(_("City is required."))


def _enrich_booking_agent_users(users: list[dict]) -> list[dict]:
	from bilan_sky.bilan_air_booking_system.utils.booking_company import enrich_agent_company_fields
	from bilan_sky.bilan_air_booking_system.utils.user_activation import user_has_set_password

	if not users:
		return []
	profiles = {
		row.user: row
		for row in frappe.get_all(
			"Booking Agent",
			filters={"user": ["in", [u["name"] for u in users]]},
			fields=[
				"name",
				"user",
				"booking_company",
				"agent_name",
				"username",
				"first_name",
				"last_name",
				"email",
				"phone",
				"phone_2",
				"city",
				"address_line1",
				"address_line2",
				"status",
				"user_type",
				"can_book_ticket",
				"can_confirm_ticket",
				"deposit_required",
				"confirmation_mode",
				"credit_limit",
				"credit_used",
				"allow_credit",
			],
		)
	}
	rows = []
	for user in users:
		row = dict(user)
		profile = profiles.get(user["name"])
		if profile:
			row["booking_agent"] = profile.name
			row["booking_company"] = profile.booking_company
			row["agent_name"] = profile.agent_name
			row["username"] = profile.username
			row["first_name"] = profile.first_name
			row["last_name"] = profile.last_name
			row["email"] = profile.email or user.get("email")
			row["phone"] = profile.phone
			row["phone_2"] = profile.phone_2
			row["city"] = profile.city
			row["address_line1"] = profile.address_line1
			row["address_line2"] = profile.address_line2
			row["full_name"] = " ".join(
				p for p in (profile.first_name, profile.last_name) if p
			).strip() or user.get("full_name")
			row["agent_status"] = profile.status
			row["status"] = profile.status
			row["user_type"] = profile.user_type
			row["can_book_ticket"] = profile.can_book_ticket
			row["can_confirm_ticket"] = profile.can_confirm_ticket
			row["deposit_required"] = profile.deposit_required
			row["confirmation_mode"] = profile.confirmation_mode
			row["credit_limit"] = profile.credit_limit
			row["credit_used"] = profile.credit_used
			row["credit_available"] = max(
				0, float(profile.credit_limit or 0) - float(profile.credit_used or 0)
			)
			row["allow_credit"] = profile.allow_credit
			enrich_agent_company_fields(row)
			row["activation_pending"] = not user_has_set_password(user["name"])
		else:
			row["booking_agent"] = None
			row["confirmation_mode"] = "Booking Only"
			row["credit_limit"] = 0
			row["credit_used"] = 0
			row["credit_available"] = 0
			row["allow_credit"] = 0
		rows.append(row)
	return rows


@frappe.whitelist()
def get_booking_agent_defaults():
	"""Defaults for the new booking agent form."""
	require_portal_staff()
	cities = frappe.db.sql(
		"""
		select distinct city from `tabAirport`
		where ifnull(city, '') != ''
		order by city asc
		""",
		as_list=True,
	)
	return {
		"status": "Active",
		"user_type": "Agent",
		"can_book_ticket": "Yes",
		"can_confirm_ticket": "Yes",
		"deposit_required": "No",
		"credit_limit": default_credit_limit(),
		"send_booking_agent_activation_email": 1 if booking_agent_activation_by_email() else 0,
		"default_country": default_address_country(),
		"cities": [row[0] for row in cities],
	}


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
		agent_meta = {
			row["user"]: row
			for row in frappe.get_all(
				"Booking Agent",
				filters={"user": ["in", [u["name"] for u in users]]},
				fields=[
					"user",
					"booking_company",
					"agent_name",
					"username",
					"city",
					"address_line1",
				],
			)
		}
		users = [
			u
			for u in users
			if q in (u.get("email") or "").lower()
			or q in (u.get("full_name") or "").lower()
			or q in (u.get("name") or "").lower()
			or q in (agent_meta.get(u["name"], {}).get("agent_name") or "").lower()
			or q in (agent_meta.get(u["name"], {}).get("username") or "").lower()
			or q in (agent_meta.get(u["name"], {}).get("city") or "").lower()
			or q in (agent_meta.get(u["name"], {}).get("address_line1") or "").lower()
		]

	enriched = _enrich_booking_agent_users(users)
	total = len(enriched)
	start = int(offset or 0)
	end = start + int(limit or 50)
	return {"data": enriched[start:end], "total": total}


@frappe.whitelist()
def get_booking_agent(name):
	require_portal_staff()
	if not name or not frappe.db.exists("Booking Agent", name):
		frappe.throw(_("Booking agent not found"))
	return serialize_booking_agent(frappe.get_doc("Booking Agent", name))


@frappe.whitelist()
def save_booking_agent(data):
	"""Update booking agent profile (credit limit, mode, etc.)."""
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	if not name or not frappe.db.exists("Booking Agent", name):
		frappe.throw(_("Booking agent not found"))

	allowed = {
		"booking_company",
		"agent_name",
		"username",
		"first_name",
		"last_name",
		"credit_limit",
		"linked_customer",
		"notes",
		"status",
		"user_type",
		"can_book_ticket",
		"can_confirm_ticket",
		"deposit_required",
		"phone",
		"phone_2",
		"address_line1",
		"address_line2",
		"city",
	}
	doc = frappe.get_doc("Booking Agent", name)
	for key in allowed:
		if key in data:
			doc.set(key, data[key])

	from bilan_sky.bilan_air_booking_system.utils.booking_company import company_agency_label

	company_name = company_agency_label(doc.booking_company) or doc.agent_name

	if any(k in data for k in ("address_line1", "address_line2", "city", "phone", "booking_company")):
		address_name = create_or_update_agent_address(
			doc.user,
			company_name=company_name,
			email=doc.email,
			address_line1=doc.address_line1,
			address_line2=doc.address_line2,
			city=doc.city,
			phone=doc.phone,
		)
		doc.agent_address = address_name

	if doc.user and any(k in data for k in ("first_name", "last_name", "phone", "phone_2")):
		user = frappe.get_doc("User", doc.user)
		if "first_name" in data:
			user.first_name = doc.first_name
		if "last_name" in data:
			user.last_name = doc.last_name
		if "phone" in data:
			user.mobile_no = doc.phone
		user.save(ignore_permissions=True)

	doc.save(ignore_permissions=True)
	sync_booking_agent_user_enabled(doc)
	frappe.db.commit()
	return get_booking_agent(doc.name)


@frappe.whitelist()
def create_booking_agent(
	email,
	first_name,
	last_name=None,
	phone=None,
	password=None,
	credit_limit=None,
	booking_company=None,
	agent_name=None,
	linked_customer=None,
	notes=None,
	username=None,
	address_line1=None,
	address_line2=None,
	city=None,
	phone_2=None,
	country=None,
	status=None,
	user_type=None,
	can_book_ticket=None,
	can_confirm_ticket=None,
	deposit_required=None,
):
	"""Create portal login user; contact, address, and rights live on Booking Agent."""
	_require_user_create_permission()
	email = (email or "").strip().lower()
	first_name = (first_name or "").strip()
	last_name = (last_name or "").strip()
	phone = (phone or "").strip()
	booking_company = (booking_company or "").strip() or None
	agent_name = (agent_name or "").strip() or None
	username = (username or "").strip()
	address_line1 = (address_line1 or "").strip()
	city = (city or "").strip()

	_validate_booking_agent_contact_fields(
		booking_company=booking_company,
		agent_name=agent_name,
		username=username,
		email=email,
		first_name=first_name,
		last_name=last_name,
		address_line1=address_line1,
		phone=phone,
		city=city,
	)

	use_activation_email = booking_agent_activation_by_email()
	if use_activation_email:
		send_activation = True
		new_password = None
	else:
		send_activation = False
		new_password = (password or "").strip()
		if not new_password:
			frappe.throw(_("Password is required when activation email is disabled in BA Settings."))

	full_name = f"{first_name} {last_name}".strip()
	user_name = create_or_get_user(
		email,
		full_name,
		mobile_no=phone,
		role=BOOKING_AGENT_ROLE,
		send_welcome_email=send_activation,
		pending_activation=use_activation_email,
		new_password=new_password,
		default_first_name="Agent",
	)

	user = frappe.get_doc("User", user_name)
	user.first_name = first_name
	user.last_name = last_name
	user.full_name = full_name
	user.mobile_no = phone
	user.save(ignore_permissions=True)

	from bilan_sky.bilan_air_booking_system.utils.booking_company import company_agency_label

	address_company = company_agency_label(booking_company) if booking_company else agent_name

	address_name = create_or_update_agent_address(
		user_name,
		company_name=address_company,
		email=email,
		address_line1=address_line1,
		address_line2=address_line2,
		city=city,
		phone=phone,
		country=country,
	)

	profile = create_booking_agent_profile(
		user=user_name,
		booking_company=booking_company,
		agent_name=agent_name,
		email=email,
		phone=phone,
		credit_limit=credit_limit if credit_limit is not None else 0,
		linked_customer=linked_customer,
		notes=notes,
		username=username,
		first_name=first_name,
		last_name=last_name,
		phone_2=(phone_2 or "").strip() or None,
		agent_address=address_name,
		address_line1=address_line1,
		address_line2=(address_line2 or "").strip() or None,
		city=city,
		status=(status or "Active").strip(),
		user_type=(user_type or "Agent").strip(),
		can_book_ticket=(can_book_ticket or "Yes").strip(),
		can_confirm_ticket=(can_confirm_ticket or "Yes").strip(),
		deposit_required=(deposit_required or "No").strip(),
	)

	sync_booking_agent_user_enabled(profile)

	frappe.db.commit()
	row = {
		"name": user.name,
		"email": user.email,
		"full_name": user.full_name,
		"enabled": user.enabled,
		"mobile_no": user.mobile_no,
		"roles": [r.role for r in user.roles],
	}
	row.update(serialize_booking_agent(profile))
	return row


@frappe.whitelist()
def resend_booking_agent_activation(booking_agent=None, user=None):
	"""Resend welcome / set-password email for a booking agent portal user."""
	require_portal_staff()
	if not booking_agent_activation_by_email():
		frappe.throw(
			_(
				"Activation email is disabled in BA Settings. Set or reset the password from Desk instead."
			)
		)
	from bilan_sky.bilan_air_booking_system.utils.user_activation import (
		send_user_activation_email,
		user_has_set_password,
	)

	user_name = user
	if booking_agent:
		if not frappe.db.exists("Booking Agent", booking_agent):
			frappe.throw(_("Booking agent not found"))
		user_name = frappe.db.get_value("Booking Agent", booking_agent, "user")
	if not user_name or not frappe.db.exists("User", user_name):
		frappe.throw(_("Portal user not found for this booking agent."))
	if user_has_set_password(user_name):
		frappe.throw(_("This user has already activated their account. Use password reset instead."))

	send_user_activation_email(user_name)
	frappe.db.commit()
	return {"success": True, "user": user_name}


@frappe.whitelist()
def list_ticket_terms(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"title": ["like", q],
			"name": ["like", q],
		}
	result = _paginated(
		"Ticket Terms",
		["name", "title", "default", "terms_conditions", "modified"],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="default desc, title asc",
	)
	for row in result["data"]:
		row["terms_conditions"] = rich_text_to_plain(row.get("terms_conditions"))
	return result


@frappe.whitelist()
def save_ticket_terms(data):
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	payload = {k: v for k, v in data.items() if k != "name"}
	if name:
		doc = frappe.get_doc("Ticket Terms", name)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Ticket Terms", **payload})
		doc.insert(ignore_permissions=True)
	frappe.db.commit()
	row = doc.as_dict()
	row["terms_conditions"] = rich_text_to_plain(row.get("terms_conditions"))
	return row


@frappe.whitelist()
def delete_ticket_terms(name):
	require_portal_staff()
	if not name or not frappe.db.exists("Ticket Terms", name):
		frappe.throw(_("Ticket terms not found"))
	doc = frappe.get_doc("Ticket Terms", name)
	doc.delete(ignore_permissions=True)
	frappe.db.commit()
	return {"success": True, "name": name}
