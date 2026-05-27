# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import cstr


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

	if frappe.db.exists("User", email):
		user_name = email
		if role and frappe.db.exists("Role", role):
			frappe.get_doc("User", user_name).add_roles(role)
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

	if role and frappe.db.exists("Role", role):
		user.add_roles(role)

	return user.name
