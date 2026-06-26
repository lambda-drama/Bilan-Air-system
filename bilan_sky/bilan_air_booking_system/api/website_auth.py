# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _
from frappe.utils import cint, getdate
from frappe.utils.password import update_password

from bilan_sky.bilan_air_booking_system.utils.portal_access import (
	require_portal_staff,
	user_has_full_portal_permissions,
	user_has_portal_access,
)
from bilan_sky.bilan_air_booking_system.utils.portal_permissions import (
	build_portal_permissions_payload,
)
from bilan_sky.bilan_air_booking_system.utils.user_accounts import (
	WEBSITE_CUSTOMER_ROLE,
	create_or_get_user,
)


def _require_logged_in_user() -> str:
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Please sign in to continue."), frappe.PermissionError)
	return user


def _user_email(user: str) -> str:
	return (frappe.db.get_value("User", user, "email") or user or "").strip().lower()


def _create_or_link_passenger(
	user_name: str,
	full_name: str,
	email: str,
	*,
	mobile_no: str | None = None,
	id_number: str | None = None,
	date_of_birth: str | None = None,
) -> str:
	"""Create a Passenger profile linked to the website user (no duplicate login)."""
	linked = frappe.db.get_value("Passenger", {"user": user_name})
	if linked:
		return linked

	if email:
		by_email = frappe.db.get_value("Passenger", {"email": email})
		if by_email:
			frappe.db.set_value("Passenger", by_email, "user", user_name, update_modified=False)
			return by_email

	id_number = (id_number or "").strip()
	if not id_number:
		safe = user_name.replace("@", "-at-").replace(".", "-")
		id_number = f"WEB-{safe}"
		if frappe.db.exists("Passenger", {"id_number": id_number}):
			id_number = f"WEB-{frappe.generate_hash(length=10)}"

	if frappe.db.exists("Passenger", {"id_number": id_number}):
		frappe.throw(_("A passenger profile with this ID number already exists."))

	phone = (mobile_no or "").strip()
	if not phone:
		frappe.throw(_("Phone number is required."))

	profile_data = {
		"doctype": "Passenger",
		"full_name": full_name,
		"passenger_type": "Adult",
		"id_number": id_number,
		"phone_number": phone,
		"email": email,
		"user": user_name,
		"is_active": 1,
	}
	if date_of_birth:
		profile_data["date_of_birth"] = getdate(date_of_birth)

	passenger = frappe.get_doc(profile_data)
	passenger.insert(ignore_permissions=True)
	return passenger.name


def _enrich_booking_rows(bookings: list[dict]) -> list[dict]:
	rows = []
	for row in bookings:
		flight_number = ""
		route_name = ""
		departure_date = ""
		departure_time = ""
		seat_labels: list[str] = []
		passenger_names: list[str] = []

		if row.get("flight_schedule"):
			schedule = frappe.db.get_value(
				"Flight Schedule",
				row.flight_schedule,
				["flight_number", "route", "departure_date", "departure_time"],
				as_dict=True,
			)
			if schedule:
				flight_number = schedule.flight_number or ""
				departure_date = str(schedule.departure_date or "")
				departure_time = str(schedule.departure_time or "")
				if schedule.route:
					route_name = (
						frappe.db.get_value("Flight Route", schedule.route, "route_name")
						or schedule.route
					)

		pax_rows = frappe.get_all(
			"Air Booking Passenger",
			filters={"parent": row.name},
			fields=["passenger_name", "seat_number"],
		)
		for pax in pax_rows:
			if pax.passenger_name:
				passenger_names.append(pax.passenger_name)
			if pax.seat_number:
				label = frappe.db.get_value("Seat Inventory", pax.seat_number, "seat_number")
				seat_labels.append(label or pax.seat_number)

		rows.append(
			{
				"name": row.name,
				"pnr": row.pnr or None,
				"reservation_ref": row.name,
				"public_reference": row.pnr or row.name,
				"flight_schedule": row.flight_schedule,
				"flight_number": flight_number,
				"route_name": route_name,
				"departure_date": departure_date,
				"departure_time": departure_time,
				"passenger_name": ", ".join(passenger_names) if passenger_names else row.payer_name,
				"seat": ", ".join(seat_labels) if seat_labels else "",
				"seat_class": "",
				"fare_amount": row.total_fare or 0,
				"status": row.reservation_status,
				"reservation_status": row.reservation_status,
				"payment_status": row.payment_status,
				"created_at": str(row.booking_date or ""),
				"payer_name": row.payer_name,
				"payer_email": row.payer_email,
				"payer_phone": row.payer_phone,
			}
		)
	return rows


@frappe.whitelist()
def get_portal_permissions():
	"""Frappe-style doctype permissions for the agent portal UI."""
	require_portal_staff()
	return build_portal_permissions_payload()


@frappe.whitelist()
def get_session_user_profile():
	"""Current user profile and roles for the website / agent portal (no Has Role API access needed)."""
	user_name = _require_logged_in_user()
	user = frappe.db.get_value(
		"User",
		user_name,
		[
			"name",
			"full_name",
			"email",
			"user_image",
			"first_name",
			"last_name",
			"phone",
			"mobile_no",
		],
		as_dict=True,
	)
	if not user:
		frappe.throw(_("User not found."), frappe.PermissionError)

	roles = list(frappe.get_roles(user_name))
	payload = {
		"name": user.name,
		"full_name": user.full_name or user.name,
		"email": user.email or "",
		"user_image": user.user_image,
		"first_name": user.first_name or "",
		"last_name": user.last_name or "",
		"phone": user.phone or "",
		"mobile_no": user.mobile_no or "",
		"roles": roles,
		"has_portal_access": user_has_portal_access(user_name),
	}
	if user_has_portal_access(user_name):
		payload.update(build_portal_permissions_payload(user_name))
	return payload


@frappe.whitelist(allow_guest=True)
def get_csrf_token():
	"""Guest-safe CSRF token for public website forms."""
	return frappe.sessions.get_csrf_token()


@frappe.whitelist(allow_guest=True)
def get_public_booking_settings():
	"""Hold window and labels for the traveler booking UI."""
	settings = frappe.get_single("BA Settings")
	hold_minutes = cint(settings.hold_duration) or 15
	hold_hours = round(hold_minutes / 60, 1) if hold_minutes >= 60 else None
	return {
		"hold_duration_minutes": hold_minutes,
		"hold_duration_hours": hold_hours,
		"hold_label": (
			f"{hold_hours:g} hours" if hold_hours and hold_minutes % 60 == 0 else f"{hold_minutes} minutes"
		),
	}


@frappe.whitelist(allow_guest=True)
def register_website_user(
	full_name,
	email,
	password,
	mobile_no=None,
	id_number=None,
	date_of_birth=None,
):
	"""Create website Customer user, linked Passenger profile, and log in."""
	full_name = (full_name or "").strip()
	email = (email or "").strip().lower()
	password = password or ""

	if not full_name:
		frappe.throw(_("Full name is required."))
	if not email:
		frappe.throw(_("Email is required."))
	if len(password) < 6:
		frappe.throw(_("Password must be at least 6 characters."))

	if frappe.db.exists("User", email):
		frappe.throw(_("An account with this email already exists. Please sign in."))

	user_name = create_or_get_user(
		email,
		full_name,
		mobile_no=mobile_no,
		role=WEBSITE_CUSTOMER_ROLE,
		send_welcome_email=0,
		default_first_name="Traveler",
	)
	update_password(user=user_name, pwd=password, logout_all_sessions=0)

	passenger = _create_or_link_passenger(
		user_name,
		full_name,
		email,
		mobile_no=mobile_no,
		id_number=id_number,
		date_of_birth=date_of_birth,
	)

	frappe.local.login_manager.login_as(user_name)
	frappe.db.commit()

	return {
		"user": user_name,
		"full_name": full_name,
		"email": email,
		"passenger": passenger,
	}


@frappe.whitelist()
def get_my_account():
	"""Profile summary for the traveler My Account page."""
	user_name = _require_logged_in_user()
	email = _user_email(user_name)
	passenger = frappe.db.get_value(
		"Passenger",
		{"user": user_name},
		["name", "full_name", "id_number", "phone_number", "email", "date_of_birth"],
		as_dict=True,
	)
	if not passenger and email:
		passenger = frappe.db.get_value(
			"Passenger",
			{"email": email},
			["name", "full_name", "id_number", "phone_number", "email", "date_of_birth"],
			as_dict=True,
		)

	user = frappe.db.get_value(
		"User",
		user_name,
		["full_name", "email", "mobile_no"],
		as_dict=True,
	)

	booking_count = frappe.db.count("Air Booking", {"payer_email": email}) if email else 0

	return {
		"user": user_name,
		"full_name": (user.full_name if user else None) or user_name,
		"email": email,
		"mobile_no": (user.mobile_no if user else None) or "",
		"passenger": passenger,
		"booking_count": booking_count,
	}


@frappe.whitelist()
def list_my_bookings(limit=50, offset=0):
	"""Bookings where the logged-in user is the payer."""
	_require_logged_in_user()
	email = _user_email(frappe.session.user)
	if not email:
		return {"data": [], "total": 0}

	limit = cint(limit) or 50
	offset = cint(offset) or 0

	filters = {"payer_email": email}
	total = frappe.db.count("Air Booking", filters)

	bookings = frappe.get_all(
		"Air Booking",
		filters=filters,
		fields=[
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
		order_by="booking_date desc",
		limit=limit,
		start=offset,
		ignore_permissions=True,
	)

	return {"data": _enrich_booking_rows(bookings), "total": total}


PORTAL_HOME_PATH = "/portal"


@frappe.whitelist(allow_guest=True, methods=["POST"])
def update_password(
	new_password: str,
	logout_all_sessions: int = 0,
	key: str | None = None,
	old_password: str | None = None,
):
	"""After password setup, send portal staff to the agent portal instead of Desk."""
	from frappe.core.doctype.user.user import update_password as frappe_update_password

	redirect = frappe_update_password(
		new_password,
		logout_all_sessions=logout_all_sessions,
		key=key,
		old_password=old_password,
	)

	user = frappe.session.user
	if user and user not in ("Guest", "Administrator") and user_has_portal_access(user):
		return PORTAL_HOME_PATH

	return redirect
