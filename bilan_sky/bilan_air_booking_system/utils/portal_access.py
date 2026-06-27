# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _

PORTAL_STAFF_ROLES = frozenset(
	{
		"Booking Agent",
		"Check-in Agent",
		"Support Agent",
		"Pricing Manager",
		"Baggage Handler",
		"Crew Member",
		"System Manager",
		"Administrator",
	}
)

FULL_PORTAL_ACCESS_ROLES = frozenset({"System Manager", "Administrator"})


def user_has_full_portal_permissions(user=None):
	"""Administrator and System Manager bypass portal doctype permission checks."""
	user = user or frappe.session.user
	if not user or user == "Guest":
		return False
	if user == "Administrator":
		return True
	return bool(FULL_PORTAL_ACCESS_ROLES.intersection(frappe.get_roles(user)))


def user_has_portal_access(user=None):
	user = user or frappe.session.user
	if not user or user == "Guest":
		return False
	return bool(PORTAL_STAFF_ROLES.intersection(frappe.get_roles(user)))


def ensure_portal_system_user(user=None):
	"""Portal staff must be System User for Role Permission Manager rules to apply."""
	user = user or frappe.session.user
	if not user_has_portal_access(user):
		return
	if frappe.db.get_value("User", user, "user_type") == "System User":
		return
	frappe.db.set_value("User", user, "user_type", "System User", update_modified=False)
	frappe.clear_cache(user=user)
	if getattr(frappe.local, "role_permissions", None) is not None:
		frappe.local.role_permissions = {}


def require_portal_staff():
	if frappe.session.user == "Guest":
		frappe.throw(_("Please sign in to the agent portal."), frappe.PermissionError)
	if not user_has_portal_access():
		frappe.throw(
			_("The agent portal is restricted to booking agents and staff."),
			frappe.PermissionError,
		)
