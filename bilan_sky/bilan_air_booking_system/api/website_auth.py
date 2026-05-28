# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _
from frappe.utils import cint
from frappe.utils.password import update_password

from bilan_sky.bilan_air_booking_system.utils.user_accounts import (
	WEBSITE_CUSTOMER_ROLE,
	create_or_get_user,
)


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
def register_website_user(full_name, email, password, mobile_no=None):
	"""Create a website Customer user and log them in (traveler self-registration)."""
	full_name = (full_name or "").strip()
	email = (email or "").strip().lower()
	password = password or ""

	if not full_name:
		frappe.throw(_("Full name is required."))
	if not email:
		frappe.throw(_("Email is required."))
	if len(password) < 6:
		frappe.throw(_("Password must be at least 6 characters."))

	user_name = create_or_get_user(
		email,
		full_name,
		mobile_no=mobile_no,
		role=WEBSITE_CUSTOMER_ROLE,
		send_welcome_email=0,
		default_first_name="Traveler",
	)
	update_password(user=user_name, pwd=password, logout_all_sessions=0)

	frappe.local.login_manager.login_as(user_name)
	frappe.db.commit()

	return {
		"user": user_name,
		"full_name": full_name,
		"email": email,
	}
