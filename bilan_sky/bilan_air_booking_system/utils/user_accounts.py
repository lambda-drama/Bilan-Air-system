# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import cstr

WEBSITE_CUSTOMER_ROLE = "Customer"


def split_full_name(full_name: str, default_first: str = "User") -> tuple[str, str]:
	parts = cstr(full_name).strip().split(None, 1)
	if not parts:
		return (default_first, "")
	if len(parts) == 1:
		return parts[0], ""
	return parts[0], parts[1]


def create_or_get_user(
	email: str,
	full_name: str,
	*,
	mobile_no: str | None = None,
	enabled: bool = True,
	role: str | None = None,
	send_welcome_email: bool = True,
	pending_activation: bool = False,
	new_password: str | None = None,
	default_first_name: str = "User",
) -> str:
	"""Create a Frappe User or return an existing one for the given email.

	When pending_activation is True the user is created disabled and must set a
	password via the welcome email before portal login is enabled.
	"""
	email = cstr(email).strip().lower()
	if not email:
		return ""

	resolved_role = role
	if resolved_role and not frappe.db.exists("Role", resolved_role):
		if resolved_role == WEBSITE_CUSTOMER_ROLE:
			_ensure_customer_role()
		if not frappe.db.exists("Role", resolved_role):
			frappe.throw(
				_("Role {0} is not set up. Run bench migrate or add the role in Desk.").format(
					resolved_role
				)
			)

	if frappe.db.exists("User", email):
		user_name = email
		user_doc = frappe.get_doc("User", user_name)
		if resolved_role:
			_apply_user_role(user_doc, resolved_role)
		if new_password:
			_set_user_password(user_name, new_password)
		elif pending_activation and send_welcome_email:
			from bilan_sky.bilan_air_booking_system.utils.user_activation import (
				send_user_activation_email,
			)

			send_user_activation_email(user_name)
		return user_name

	first_name, last_name = split_full_name(full_name, default_first=default_first_name)
	user_enabled = 0 if pending_activation else (1 if enabled else 0)
	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"last_name": last_name,
			"full_name": full_name,
			"mobile_no": mobile_no,
			"enabled": user_enabled,
			"send_welcome_email": 1 if send_welcome_email else 0,
		}
	)
	user.flags.no_welcome_mail = not send_welcome_email
	if resolved_role:
		user.append_roles(resolved_role)
	user.insert(ignore_permissions=True)

	if new_password:
		_set_user_password(user.name, new_password)

	return user.name


def _apply_user_role(user, role: str) -> None:
	"""Assign a role without using User.add_roles (its save ignores portal permissions)."""
	if not role or role in {d.role for d in user.get("roles")}:
		return
	user.append_roles(role)
	if not user.is_new():
		user.save(ignore_permissions=True)


def _set_user_password(user: str, password: str) -> None:
	from frappe.utils.password import update_password

	password = cstr(password)
	if len(password) < 8:
		frappe.throw(_("Password must be at least 8 characters."))
	update_password(user, password, logout_all_sessions=False)


def _ensure_customer_role():
	"""Website role for passengers who register on the public site."""
	if frappe.db.exists("Role", WEBSITE_CUSTOMER_ROLE):
		return
	frappe.get_doc(
		{
			"doctype": "Role",
			"role_name": WEBSITE_CUSTOMER_ROLE,
			"desk_access": 0,
		}
	).insert(ignore_permissions=True)
