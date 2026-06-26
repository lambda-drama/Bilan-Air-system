# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _
from frappe.permissions import allow_everything, get_rights

from bilan_sky.bilan_air_booking_system.utils.portal_access import (
	ensure_portal_system_user,
	require_portal_staff,
	user_has_full_portal_permissions,
)
from bilan_sky.bilan_air_booking_system.utils.portal_report_access import get_agent_report_permissions

# Doctypes exposed in the agent portal UI (mirrors frontend route mapping).
PORTAL_DOCTYPES = (
	"Flight Setup",
	"Flight Schedule Plan",
	"Flight Schedule",
	"Seat Inventory",
	"Air Booking",
	"Baggage Tracking",
	"Passenger",
	"Website Contact Message",
	"Airport",
	"Airline",
	"Flight Route",
	"Airplane",
	"Cabin Class",
	"Seat Class",
	"Ticket Terms",
	"Booking Agent",
	"Booking Company",
	"Crew Member",
	"Fare Rule",
	"Sales Invoice",
	"Payment Entry",
	"User",
	"BA Settings",
)


def portal_query_ignore_permissions() -> bool:
	"""Whether list/get queries should bypass Frappe permission filters."""
	return user_has_full_portal_permissions()


def list_requires_owner_filter(doctype: str, user: str | None = None) -> bool:
	"""True when this user may only read/list documents they own (Frappe if_owner rules)."""
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user):
		return False
	from frappe.model.db_query import requires_owner_constraint
	from frappe.permissions import get_role_permissions

	meta = frappe.get_meta(doctype)
	role_perms = get_role_permissions(meta, user=user)
	return bool(requires_owner_constraint(role_perms))


def portal_list_filters(doctype: str, filters: dict | None = None, user: str | None = None) -> dict:
	"""Apply owner-scoped list filters when the user's role permissions require it."""
	filters = dict(filters or {})
	user = user or frappe.session.user
	if list_requires_owner_filter(doctype, user=user):
		filters["owner"] = user
	return filters


def get_doc_action_flags(doc) -> dict[str, int]:
	"""Per-document read/write/delete flags for portal row actions."""
	if user_has_full_portal_permissions():
		return {"can_read": 1, "can_write": 1, "can_delete": 1}
	doctype = doc.doctype
	return {
		"can_read": int(
			has_portal_read_permission(doctype)
			and frappe.has_permission(doctype, "read", doc=doc)
		),
		"can_write": int(frappe.has_permission(doctype, "write", doc=doc)),
		"can_delete": int(frappe.has_permission(doctype, "delete", doc=doc)),
	}


def get_owner_scoped_permissions(doctype: str, user: str | None = None) -> dict[str, int]:
	"""Permission types that are granted only when the user owns the document."""
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user):
		return {}
	from frappe.permissions import get_role_permissions

	meta = frappe.get_meta(doctype)
	role_perms = get_role_permissions(meta, user=user, is_owner=False)
	if not role_perms.get("has_if_owner_enabled"):
		return {}
	scoped: dict[str, int] = {}
	for ptype in get_rights(doctype):
		if ptype == "create":
			continue
		if role_perms.get(ptype):
			continue
		if role_perms.get("if_owner", {}).get(ptype):
			scoped[ptype] = 1
	return scoped


def has_portal_read_permission(doctype: str, user: str | None = None) -> bool:
	"""Portal list/detail pages: Frappe Select is enough when Read is not granted."""
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user):
		return True
	return frappe.has_permission(doctype, "read", user=user) or frappe.has_permission(
		doctype, "select", user=user
	)


def get_doctype_permissions(doctype: str, user: str | None = None) -> dict[str, int]:
	"""Return Frappe-style permission flags for a doctype (1 = allowed, 0 = denied)."""
	user = user or frappe.session.user
	if user_has_full_portal_permissions(user):
		perms = allow_everything(doctype)
		perms["owner_scoped"] = {}
		return perms
	perms: dict[str, int] = {}
	for ptype in get_rights(doctype):
		perms[ptype] = 1 if frappe.has_permission(doctype, ptype, user=user) else 0
	# Mirror Frappe Desk: Select allows opening read-only portal pages/lists.
	if not perms.get("read") and perms.get("select"):
		perms["read"] = 1
	owner_scoped = get_owner_scoped_permissions(doctype, user=user)
	if owner_scoped:
		perms["owner_scoped"] = owner_scoped
	return perms


def get_portal_permissions(user: str | None = None) -> dict[str, dict[str, int]]:
	user = user or frappe.session.user
	ensure_portal_system_user(user)
	return {doctype: get_doctype_permissions(doctype, user=user) for doctype in PORTAL_DOCTYPES}


def build_portal_permissions_payload(user: str | None = None) -> dict:
	"""Full permissions response for the portal UI."""
	user = user or frappe.session.user
	ensure_portal_system_user(user)
	return {
		"has_full_access": user_has_full_portal_permissions(user),
		"permissions": get_portal_permissions(user),
		"agent_reports": get_agent_report_permissions(user),
	}


def require_doctype_permission(doctype: str, ptype: str = "read") -> None:
	"""Ensure the current portal user may perform ``ptype`` on ``doctype``."""
	require_portal_staff()
	ensure_portal_system_user()
	if user_has_full_portal_permissions():
		return
	if ptype == "read":
		if has_portal_read_permission(doctype):
			return
	elif frappe.has_permission(doctype, ptype):
		return
	frappe.throw(
		_("You do not have permission to {0} {1}.").format(_(ptype.title()), doctype),
		frappe.PermissionError,
	)


def require_doctype_permission_any(doctype: str, *ptypes: str) -> None:
	"""Ensure the current portal user has at least one of the given permissions."""
	require_portal_staff()
	ensure_portal_system_user()
	if user_has_full_portal_permissions():
		return
	if any(frappe.has_permission(doctype, ptype) for ptype in ptypes):
		return
	labels = ", ".join(_(p.title()) for p in ptypes)
	frappe.throw(
		_("You do not have permission to {0} on {1}.").format(labels, doctype),
		frappe.PermissionError,
	)


def require_doc_permission(doc, ptype: str = "read") -> None:
	"""Ensure the current portal user may perform ``ptype`` on this document (incl. if_owner)."""
	require_portal_staff()
	ensure_portal_system_user()
	if user_has_full_portal_permissions():
		return
	if ptype == "read":
		if has_portal_read_permission(doc.doctype) and frappe.has_permission(
			doc.doctype, "read", doc=doc
		):
			return
	elif frappe.has_permission(doc.doctype, ptype, doc=doc):
		return
	frappe.throw(
		_("You do not have permission to {0} {1}.").format(_(ptype.title()), doc.doctype),
		frappe.PermissionError,
	)


def save_portal_doc(doc, *, is_new: bool) -> "frappe.model.document.Document":
	"""Save or insert a document after checking create/write permissions."""
	doctype = doc.doctype
	ignore = user_has_full_portal_permissions()
	if not ignore:
		if is_new:
			require_doctype_permission(doctype, "create")
		else:
			require_doc_permission(doc, "write")
	if is_new:
		doc.insert(ignore_permissions=ignore)
	else:
		doc.save(ignore_permissions=ignore)
	return doc


def delete_portal_doc(doctype: str, name: str) -> None:
	require_portal_staff()
	ignore = user_has_full_portal_permissions()
	if not ignore:
		doc = frappe.get_doc(doctype, name)
		require_doc_permission(doc, "delete")
	frappe.delete_doc(doctype, name, ignore_permissions=ignore)
