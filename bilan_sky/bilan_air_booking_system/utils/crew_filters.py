"""Crew role filters for flight scheduling (captain must be a pilot)."""

from __future__ import annotations

import re

import frappe
from frappe import _

PILOT_CATEGORY = "Pilot"

_CAPTAIN_ROLE_RE = re.compile(r"captain", re.I)
_FIRST_OFFICER_ROLE_RE = re.compile(r"first\s*officer|co-?pilot|\bfo\b", re.I)


def _is_captain_role_name(role_name: str | None) -> bool:
	name = (role_name or "").strip()
	if not name or _FIRST_OFFICER_ROLE_RE.search(name):
		return False
	return bool(_CAPTAIN_ROLE_RE.search(name))


def _is_first_officer_role_name(role_name: str | None) -> bool:
	return bool(_FIRST_OFFICER_ROLE_RE.search((role_name or "").strip()))


def get_active_pilot_roles() -> list[dict]:
	return frappe.get_all(
		"Crew Role",
		filters={"category": PILOT_CATEGORY, "is_active": 1},
		fields=["name", "role_name"],
		order_by="role_name asc",
	)


def pilot_crew_role_names(*, captain_only: bool = False, first_officer_only: bool = False) -> list[str]:
	"""Crew Role names (link targets) for pilot-category filters."""
	roles = get_active_pilot_roles()
	if not roles:
		return []

	if captain_only:
		captain_roles = [r.name for r in roles if _is_captain_role_name(r.role_name)]
		return captain_roles or [r.name for r in roles]

	if first_officer_only:
		fo_roles = [r.name for r in roles if _is_first_officer_role_name(r.role_name)]
		if fo_roles:
			return fo_roles
		return [r.name for r in roles if not _is_captain_role_name(r.role_name)]

	return [r.name for r in roles]


def crew_role_category(crew_role: str | None) -> str | None:
	if not crew_role:
		return None
	return frappe.db.get_value("Crew Role", crew_role, "category")


def crew_member_is_pilot(crew_member: str | None) -> bool:
	if not crew_member:
		return False
	role = frappe.db.get_value("Crew Member", crew_member, "crew_role")
	return crew_role_category(role) == PILOT_CATEGORY


def validate_flight_crew_pilots(doc, *, require_captain: bool = True) -> None:
	"""Ensure captain (and optional FO) are active crew with Pilot-category roles."""
	if require_captain and not doc.captain:
		frappe.throw(_("Captain is required."))

	if doc.captain and not crew_member_is_pilot(doc.captain):
		frappe.throw(
			_("Captain must be a crew member with a Pilot role (Crew Role category: Pilot)."),
			title=_("Invalid captain"),
		)

	if getattr(doc, "first_officer", None) and doc.first_officer:
		if not crew_member_is_pilot(doc.first_officer):
			frappe.throw(
				_("First Officer must be a crew member with a Pilot role (Crew Role category: Pilot)."),
				title=_("Invalid first officer"),
			)
		if doc.first_officer == doc.captain:
			frappe.throw(_("Captain and First Officer cannot be the same person."))


def crew_member_filters_for_capacity(capacity: str) -> dict:
	"""Build Crew Member list filters for portal/API."""
	filters: dict = {"status": "Active"}
	capacity = (capacity or "").strip().lower()

	if capacity == "captain":
		roles = pilot_crew_role_names(captain_only=True)
	elif capacity == "first_officer":
		roles = pilot_crew_role_names(first_officer_only=True)
	elif capacity in ("pilot", "pilots"):
		roles = pilot_crew_role_names()
	else:
		return filters

	if roles:
		filters["crew_role"] = ["in", roles]
	else:
		filters["crew_role"] = ["in", ["__invalid__"]]
	return filters


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def crew_member_link_query(doctype, txt, searchfield, start, page_len, filters):
	"""Desk Link search: captain / first_officer → Pilot-category crew only."""
	capacity = (filters or {}).get("capacity") or "pilot"
	role_names = role_names_for_capacity(capacity)
	if not role_names:
		return []

	filters = {"status": "Active", "crew_role": ["in", role_names]}
	or_filters = None
	if txt:
		or_filters = [
			["name", "like", f"%{txt}%"],
			["full_name", "like", f"%{txt}%"],
			["employee_id", "like", f"%{txt}%"],
		]

	return frappe.get_list(
		"Crew Member",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "full_name", "employee_id"],
		order_by="full_name asc",
		limit_start=start,
		limit_page_length=page_len,
		as_list=False,
	)


def role_names_for_capacity(capacity: str) -> list[str]:
	capacity = (capacity or "").strip().lower()
	if capacity == "captain":
		return pilot_crew_role_names(captain_only=True)
	if capacity == "first_officer":
		return pilot_crew_role_names(first_officer_only=True)
	return pilot_crew_role_names()
