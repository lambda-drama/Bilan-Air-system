# Copyright (c) 2026, NF and contributors

"""Booking-agent report/dashboard access from BA Settings."""

import frappe
from frappe import _
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting
from bilan_sky.bilan_air_booking_system.utils.portal_access import (
	require_portal_staff,
	user_has_full_portal_permissions,
)

BOOKING_AGENT_ROLE = "Booking Agent"
SUB_AGENT_ROLE = "Sub Agent"
AGENT_SCOPED_ROLES = frozenset({BOOKING_AGENT_ROLE, SUB_AGENT_ROLE})

AGENT_REPORT_FIELDS = {
	"analytics": "agent_view_analytics",
	"dashboard": "agent_view_dashboard",
	"manifest": "agent_view_manifest",
	"no_show": "agent_view_no_show",
	"agent_sales": "agent_view_agent_sales",
}


def user_is_booking_agent(user: str | None = None) -> bool:
	"""True when the user is a Booking Agent / Sub Agent or has a linked Booking Agent profile."""
	user = user or frappe.session.user
	if AGENT_SCOPED_ROLES.intersection(frappe.get_roles(user)):
		return True
	if not frappe.db.table_exists("tabBooking Agent"):
		return False
	return bool(frappe.db.exists("Booking Agent", {"user": user}))


def get_agent_report_permissions(user: str | None = None) -> dict[str, int]:
	"""Report flags for the portal UI (1 = allowed, 0 = denied)."""
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user) or not user_is_booking_agent(user):
		return {key: 1 for key in AGENT_REPORT_FIELDS}
	return {
		key: cint(get_ba_setting(fieldname, 0)) for key, fieldname in AGENT_REPORT_FIELDS.items()
	}


def can_access_agent_report(report_key: str, user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user):
		return True
	if not user_is_booking_agent(user):
		return True
	fieldname = AGENT_REPORT_FIELDS.get(report_key)
	if not fieldname:
		return False
	return bool(cint(get_ba_setting(fieldname, 0)))


def require_agent_report_access(report_key: str) -> None:
	"""Ensure the current portal user may access this report or dashboard section."""
	require_portal_staff()
	if can_access_agent_report(report_key):
		return
	labels = {
		"analytics": _("Analytics"),
		"dashboard": _("Dashboard"),
		"manifest": _("Manifest"),
		"no_show": _("No show report"),
		"agent_sales": _("Agent sales report"),
	}
	label = labels.get(report_key, report_key)
	frappe.throw(
		_("You do not have permission to view {0}.").format(label),
		frappe.PermissionError,
	)


def require_agent_report_access_any(*report_keys: str) -> None:
	"""Ensure the current portal user may access at least one of the given reports."""
	require_portal_staff()
	if user_has_full_portal_permissions():
		return
	if not user_is_booking_agent(user):
		return
	if any(can_access_agent_report(key) for key in report_keys):
		return
	frappe.throw(_("You do not have permission to view this report."), frappe.PermissionError)
