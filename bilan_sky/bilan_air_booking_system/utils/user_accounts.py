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
	default_first_name: str = "User",
) -> str:
	"""Create a Frappe User or return an existing one for the given email."""
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
		if resolved_role:
			frappe.get_doc("User", user_name).add_roles(resolved_role)
		return user_name

	first_name, last_name = split_full_name(full_name, default_first=default_first_name)
	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"last_name": last_name,
			"full_name": full_name,
			"mobile_no": mobile_no,
			"enabled": 1 if enabled else 0,
			"send_welcome_email": 1 if send_welcome_email else 0,
		}
	)
	user.insert(ignore_permissions=True)

	if resolved_role:
		user.add_roles(resolved_role)

	return user.name


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
