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


def user_has_portal_access(user=None):
	user = user or frappe.session.user
	if not user or user == "Guest":
		return False
	return bool(PORTAL_STAFF_ROLES.intersection(frappe.get_roles(user)))


def require_portal_staff():
	if frappe.session.user == "Guest":
		frappe.throw(_("Please sign in to the agent portal."), frappe.PermissionError)
	if not user_has_portal_access():
		frappe.throw(
			_("The agent portal is restricted to booking agents and staff."),
			frappe.PermissionError,
		)
