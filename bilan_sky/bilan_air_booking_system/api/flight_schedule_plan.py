"""Portal and desk APIs for recurring flight schedule plans."""

import frappe
from frappe import _
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.api.portal import _paginated
from bilan_sky.bilan_air_booking_system.utils.fare_pricing import apply_schedule_fare_override
from bilan_sky.bilan_air_booking_system.utils.flight_schedule_plan import (
	count_plan_occurrences,
	generate_flight_schedules_from_plan,
	next_plan_title,
)
from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff


def _parse_data(data):
	if isinstance(data, str):
		import json

		return json.loads(data)
	return data or {}


@frappe.whitelist()
def get_flight_schedule_plan_defaults():
	"""Defaults for the portal new-plan dialog."""
	require_portal_staff()
	return {"suggested_plan_title": next_plan_title()}


@frappe.whitelist()
def list_flight_schedule_plans(limit=50, offset=0, search=None):
	require_portal_staff()
	or_filters = None
	if search:
		q = f"%{search.strip()}%"
		or_filters = {
			"plan_title": ["like", q],
			"route": ["like", q],
			"name": ["like", q],
		}
	return _paginated(
		"Flight Schedule Plan",
		[
			"name",
			"plan_title",
			"frequency",
			"start_date",
			"end_date",
			"route",
			"airplane",
			"plan_status",
			"generated_count",
			"last_generated_on",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
		order_by="modified desc",
	)


@frappe.whitelist()
def get_flight_schedule_plan(name):
	require_portal_staff()
	doc = frappe.get_doc("Flight Schedule Plan", name)
	row = doc.as_dict()
	row["seat_classes"] = [r.as_dict() for r in doc.seat_classes or []]
	row["cabin_crew"] = [r.as_dict() for r in doc.cabin_crew or []]
	row["occurrence_count"] = count_plan_occurrences(doc)
	return row


@frappe.whitelist()
def save_flight_schedule_plan(data):
	"""Create or update a recurring flight plan (does not generate flights until generate is called)."""
	require_portal_staff()
	data = _parse_data(data)
	name = data.get("name")
	seat_classes = data.pop("seat_classes", None)
	cabin_crew = data.pop("cabin_crew", None)
	from bilan_sky.bilan_air_booking_system.utils.fare_pricing import normalize_schedule_override_payload

	normalize_schedule_override_payload(data)
	payload = {k: v for k, v in data.items() if k not in ("name", "base_fares_override", "base_fare_override")}

	if not (payload.get("plan_title") or "").strip():
		payload["plan_title"] = next_plan_title()

	if name:
		doc = frappe.get_doc("Flight Schedule Plan", name)
		doc.update(payload)
		if seat_classes is not None:
			doc.set("seat_classes", seat_classes)
		if cabin_crew is not None:
			doc.set("cabin_crew", cabin_crew)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Flight Schedule Plan", **payload})
		if seat_classes is not None:
			doc.set("seat_classes", seat_classes)
		if cabin_crew is not None:
			doc.set("cabin_crew", cabin_crew)
		doc.insert(ignore_permissions=True)

	frappe.db.commit()
	return get_flight_schedule_plan(doc.name)


@frappe.whitelist()
def preview_plan_occurrences(plan_name=None, data=None):
	"""Return how many flights a plan would create."""
	require_portal_staff()
	if plan_name and frappe.db.exists("Flight Schedule Plan", plan_name):
		doc = frappe.get_doc("Flight Schedule Plan", plan_name)
	else:
		doc = frappe.get_doc({"doctype": "Flight Schedule Plan", **_parse_data(data)})
	return {"count": count_plan_occurrences(doc)}


@frappe.whitelist()
def generate_plan_schedules(plan_name, submit=1):
	require_portal_staff()
	if not plan_name or not frappe.db.exists("Flight Schedule Plan", plan_name):
		frappe.throw(_("Flight Schedule Plan not found"))
	return generate_flight_schedules_from_plan(plan_name, submit=cint(submit))
