"""Generate Flight Schedule documents from a recurring plan."""

from __future__ import annotations

import calendar
from collections.abc import Iterator
from datetime import date

import frappe
from frappe import _
from frappe.utils import add_days, add_months, cint, getdate  # cint used in payload

from bilan_sky.bilan_air_booking_system.utils.fare_pricing import apply_schedule_fare_overrides
from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
	assert_unique_flight_number,
	schedule_document_name,
)

MAX_OCCURRENCES = 400

WEEKDAY_FIELDS = (
	("sunday", 6),
	("monday", 0),
	("tuesday", 1),
	("wednesday", 2),
	("thursday", 3),
	("friday", 4),
	("saturday", 5),
)


def _weekly_days(plan) -> set[int]:
	selected = {idx for field, idx in WEEKDAY_FIELDS if cint(getattr(plan, field, None))}
	if not selected:
		frappe.throw(_("Select at least one day of the week for a weekly plan."))
	return selected


def iter_plan_departure_dates(plan) -> Iterator[date]:
	start = getdate(plan.start_date)
	end = getdate(plan.end_date)
	if end < start:
		frappe.throw(_("End Date cannot be before Start Date."))

	frequency = (plan.frequency or "").strip()

	if frequency == "Daily":
		current = start
		while current <= end:
			yield current
			current = add_days(current, 1)
		return

	if frequency == "Weekly":
		allowed = _weekly_days(plan)
		current = start
		while current <= end:
			if current.weekday() in allowed:
				yield current
			current = add_days(current, 1)
		return

	if frequency == "Monthly":
		day_of_month = cint(plan.monthly_day) or start.day
		if day_of_month < 1 or day_of_month > 31:
			frappe.throw(_("Monthly day must be between 1 and 31."))

		cursor = getdate(start.replace(day=1))
		end_month = getdate(end.replace(day=1))
		while cursor <= end_month:
			last_day = calendar.monthrange(cursor.year, cursor.month)[1]
			day = min(day_of_month, last_day)
			candidate = getdate(f"{cursor.year}-{cursor.month:02d}-{day:02d}")
			if start <= candidate <= end:
				yield candidate
			cursor = add_months(cursor, 1)
			cursor = getdate(cursor.replace(day=1))
		return

	frappe.throw(_("Frequency must be Daily, Weekly, or Monthly."))


def count_plan_occurrences(plan) -> int:
	return sum(1 for _ in iter_plan_departure_dates(plan))


def _arrival_date_for_departure(plan, departure_date):
	offset = cint(plan.arrival_day_offset) or 0
	return add_days(getdate(departure_date), offset)


def _schedule_payload_from_plan(plan, departure_date: date) -> dict:
	arrival_date = _arrival_date_for_departure(plan, departure_date)
	payload = {
		"doctype": "Flight Schedule",
		"route": plan.route,
		"airplane": plan.airplane,
		"departure_date": departure_date,
		"departure_time": plan.departure_time,
		"arrival_date": arrival_date,
		"arrival_time": plan.arrival_time,
		"status": plan.status or "Scheduled",
		"initial_seats_released": cint(getattr(plan, "initial_seats_released", 0) or 0),
		"schedule_plan": plan.name,
		"captain": plan.captain,
		"first_officer": plan.first_officer or None,
		"cabin_crew": [],
	}
	for row in plan.cabin_crew or []:
		payload["cabin_crew"].append(
			{
				"crew_member": row.crew_member,
				"role": row.role,
			}
		)
	return payload


def _apply_fare_override(doc, plan):
	apply_schedule_fare_overrides(
		doc,
		adult=getattr(plan, "base_fare_adult_override", None),
		child=getattr(plan, "base_fare_child_override", None),
		infant=getattr(plan, "base_fare_infant_override", None),
	)


def generate_flight_schedules_from_plan(plan_name: str, *, submit: bool = True) -> dict:
	"""Create one Flight Schedule per plan occurrence."""
	plan = frappe.get_doc("Flight Schedule Plan", plan_name)
	occurrences = count_plan_occurrences(plan)
	if occurrences > MAX_OCCURRENCES:
		frappe.throw(
			_("This plan would create {0} flights (max {1}). Narrow the date range or frequency.").format(
				occurrences, MAX_OCCURRENCES
			)
		)
	if occurrences == 0:
		frappe.throw(_("No flight dates match this plan. Check the date range and frequency settings."))

	created = []
	skipped = []

	for departure_date in iter_plan_departure_dates(plan):
		doc = frappe.get_doc(_schedule_payload_from_plan(plan, departure_date))
		doc._ensure_flight_number()
		if not doc.flight_number:
			skipped.append({"departure_date": str(departure_date), "reason": "Could not assign flight number"})
			continue

		expected_name = schedule_document_name(doc.flight_number, doc.departure_date)
		if frappe.db.exists("Flight Schedule", expected_name):
			skipped.append(
				{
					"departure_date": str(departure_date),
					"reason": f"Schedule {expected_name} already exists",
				}
			)
			continue

		try:
			assert_unique_flight_number(doc.flight_number, doc.departure_date)
		except frappe.ValidationError as exc:
			skipped.append({"departure_date": str(departure_date), "reason": str(exc)})
			continue

		_apply_fare_override(doc, plan)
		doc.insert(ignore_permissions=True)
		seats = doc.generate_seat_inventory(raise_on_error=False)

		if submit and doc.docstatus == 0:
			doc.submit()

		created.append(
			{
				"name": doc.name,
				"departure_date": str(doc.departure_date),
				"seats_created": seats,
			}
		)

	plan.db_set(
		{
			"generated_count": len(created),
			"last_generated_on": frappe.utils.now(),
		},
		update_modified=True,
	)
	frappe.db.commit()

	return {
		"plan": plan.name,
		"created_count": len(created),
		"skipped_count": len(skipped),
		"created": created,
		"skipped": skipped,
	}
