"""Generate Flight Schedule documents from a recurring plan."""

from __future__ import annotations

import calendar
from collections.abc import Iterator
from datetime import date

import frappe
from frappe import _
from frappe.utils import add_days, add_months, cint, cstr, getdate  # cint used in payload

from bilan_sky.bilan_air_booking_system.utils.fare_pricing import apply_schedule_fare_overrides
from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
	assert_unique_flight_number,
	schedule_document_name,
)

MAX_OCCURRENCES = 400
PLAN_TITLE_SERIES = "RFP-.######"
GENERATION_STATUS_CACHE_PREFIX = "flight_plan_gen_status:"
GENERATION_STATUS_TTL = 3600


def next_plan_title() -> str:
	"""Next recurring flight plan title (e.g. RFP-000001)."""
	from frappe.model.naming import make_autoname

	return make_autoname(PLAN_TITLE_SERIES)

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


def _plan_initial_seats_released(plan) -> int:
	if plan.seat_classes:
		total = sum(cint(getattr(row, "number_of_seats", 0)) for row in plan.seat_classes)
		if total > 0:
			return total
	return cint(getattr(plan, "initial_seats_released", 0) or 0)


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
		"initial_seats_released": _plan_initial_seats_released(plan),
		"schedule_plan": plan.name,
		"captain": plan.captain,
		"first_officer": plan.first_officer,
		"cabin_crew": [],
	}
	if getattr(plan, "flight_number", None):
		payload["flight_number"] = plan.flight_number
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


PLAN_SCHEDULE_SYNC_FIELDS = (
	"route",
	"airplane",
	"departure_time",
	"arrival_time",
	"arrival_day_offset",
	"status",
	"captain",
	"first_officer",
	"base_fare_adult_override",
	"base_fare_child_override",
	"base_fare_infant_override",
	"initial_seats_released",
)


def plan_changes_require_schedule_sync(plan) -> bool:
	if plan.is_new():
		return False
	if any(plan.has_value_changed(field) for field in PLAN_SCHEDULE_SYNC_FIELDS):
		return True
	return plan.has_value_changed("seat_classes") or plan.has_value_changed("cabin_crew")


def _sync_cabin_crew_table(schedule_name: str, plan) -> None:
	frappe.db.delete(
		"Flight Crew Assignment",
		{"parent": schedule_name, "parenttype": "Flight Schedule", "parentfield": "cabin_crew"},
	)
	for index, row in enumerate(plan.cabin_crew or [], start=1):
		frappe.get_doc(
			{
				"doctype": "Flight Crew Assignment",
				"parent": schedule_name,
				"parenttype": "Flight Schedule",
				"parentfield": "cabin_crew",
				"idx": index,
				"crew_member": row.crew_member,
				"role": row.role,
			}
		).insert(ignore_permissions=True)


def _sync_single_schedule_from_plan(plan, schedule_name: str) -> None:
	from bilan_sky.bilan_air_booking_system.utils.seat_release import (
		apply_plan_seat_class_release,
		apply_release_status_to_schedule,
	)

	schedule = frappe.get_doc("Flight Schedule", schedule_name)
	arrival_date = _arrival_date_for_departure(plan, schedule.departure_date)

	schedule.route = plan.route
	schedule.airplane = plan.airplane
	schedule.departure_time = plan.departure_time
	schedule.arrival_date = arrival_date
	schedule.arrival_time = plan.arrival_time
	schedule.status = plan.status or schedule.status
	schedule.captain = plan.captain
	schedule.first_officer = plan.first_officer
	schedule.initial_seats_released = _plan_initial_seats_released(plan)
	schedule.set("cabin_crew", [])
	for row in plan.cabin_crew or []:
		schedule.append(
			"cabin_crew",
			{
				"crew_member": row.crew_member,
				"role": row.role,
			},
		)
	_apply_fare_override(schedule, plan)

	if schedule.docstatus == 1:
		frappe.db.set_value(
			"Flight Schedule",
			schedule_name,
			{
				"route": schedule.route,
				"airplane": schedule.airplane,
				"departure_time": schedule.departure_time,
				"arrival_date": schedule.arrival_date,
				"arrival_time": schedule.arrival_time,
				"status": schedule.status,
				"captain": schedule.captain,
				"first_officer": schedule.first_officer,
				"initial_seats_released": schedule.initial_seats_released,
			},
			update_modified=True,
		)
		_sync_cabin_crew_table(schedule_name, plan)
		schedule = frappe.get_doc("Flight Schedule", schedule_name)
		_apply_fare_override(schedule, plan)
		schedule.save(ignore_permissions=True)
	else:
		schedule.save(ignore_permissions=True)

	schedule = frappe.get_doc("Flight Schedule", schedule_name)
	if schedule.route and schedule.segments:
		schedule._refresh_segment_arrival_estimates()
		for row in schedule.segments:
			row.db_update()

	schedule.generate_seat_inventory(raise_on_error=False)
	if plan.seat_classes:
		apply_plan_seat_class_release(schedule, plan)
	else:
		apply_release_status_to_schedule(schedule, only_unreleased=False)


def sync_generated_schedules_from_plan(plan_name: str) -> dict:
	"""Push plan timing, crew, fares, and seat-class quotas to linked flight schedules."""
	schedule_names = frappe.get_all(
		"Flight Schedule",
		filters={"schedule_plan": plan_name},
		pluck="name",
		order_by="departure_date asc",
	)
	if not schedule_names:
		return {"updated_count": 0, "updated": [], "skipped": []}

	updated = []
	skipped = []
	plan = frappe.get_doc("Flight Schedule Plan", plan_name)
	for schedule_name in schedule_names:
		try:
			_sync_single_schedule_from_plan(plan, schedule_name)
			updated.append(schedule_name)
		except Exception as exc:
			frappe.log_error(title=f"Plan schedule sync failed ({plan_name} → {schedule_name})")
			skipped.append({"name": schedule_name, "reason": cstr(exc) or _("Sync failed.")})

	return {"updated_count": len(updated), "updated": updated, "skipped": skipped}


def generate_flight_schedules_from_plan(
	plan_name: str, *, submit: bool = True, track_progress: bool = False
) -> dict:
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

	def report_progress(processed: int) -> None:
		if not track_progress:
			return
		set_plan_generation_status(
			plan_name,
			{
				"status": "running",
				"plan": plan_name,
				"plan_title": plan.plan_title,
				"expected_count": occurrences,
				"processed_count": processed,
			},
		)

	for index, departure_date in enumerate(iter_plan_departure_dates(plan), start=1):
		doc = frappe.get_doc(_schedule_payload_from_plan(plan, departure_date))
		doc._ensure_flight_number()
		if not doc.flight_number:
			skipped.append({"departure_date": str(departure_date), "reason": "Could not assign flight number"})
			report_progress(index)
			continue

		expected_name = schedule_document_name(doc.flight_number, doc.departure_date)
		if frappe.db.exists("Flight Schedule", expected_name):
			skipped.append(
				{
					"departure_date": str(departure_date),
					"reason": f"Schedule {expected_name} already exists",
				}
			)
			report_progress(index)
			continue

		try:
			assert_unique_flight_number(doc.flight_number, doc.departure_date)
		except frappe.ValidationError as exc:
			skipped.append({"departure_date": str(departure_date), "reason": str(exc)})
			report_progress(index)
			continue

		_apply_fare_override(doc, plan)
		doc.insert(ignore_permissions=True)
		seats = doc.generate_seat_inventory(raise_on_error=False)
		if plan.seat_classes:
			from bilan_sky.bilan_air_booking_system.utils.seat_release import apply_plan_seat_class_release

			apply_plan_seat_class_release(doc, plan)

		if submit and doc.docstatus == 0:
			doc.submit()

		created.append(
			{
				"name": doc.name,
				"departure_date": str(doc.departure_date),
				"seats_created": seats,
			}
		)
		report_progress(index)

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


def validate_plan_can_generate(plan_name: str) -> int:
	"""Validate a plan can generate schedules; return occurrence count."""
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
	return occurrences


def _generation_status_key(plan_name: str) -> str:
	return f"{GENERATION_STATUS_CACHE_PREFIX}{plan_name}"


def set_plan_generation_status(plan_name: str, status: dict) -> None:
	frappe.cache.set_value(_generation_status_key(plan_name), status, expires_in_sec=GENERATION_STATUS_TTL)


def read_plan_generation_status(plan_name: str) -> dict:
	return frappe.cache.get_value(_generation_status_key(plan_name)) or {"status": "idle"}


def _notify_plan_generation(user: str | None, payload: dict) -> None:
	if not user:
		return
	frappe.publish_realtime("flight_plan_generation", payload, user=user)


def _generate_flight_schedules_from_plan_job(plan_name: str, submit: bool = True, user: str | None = None):
	try:
		result = generate_flight_schedules_from_plan(plan_name, submit=submit, track_progress=True)
		plan_title = frappe.db.get_value("Flight Schedule Plan", plan_name, "plan_title")
		payload = {
			"status": "complete",
			"plan": plan_name,
			"plan_title": plan_title,
			"created_count": result["created_count"],
			"skipped_count": result["skipped_count"],
		}
		set_plan_generation_status(plan_name, payload)
		_notify_plan_generation(user, payload)
	except Exception as exc:
		frappe.log_error(title=f"Flight plan generation failed ({plan_name})")
		payload = {
			"status": "failed",
			"plan": plan_name,
			"message": cstr(exc) or _("Flight schedule generation failed."),
		}
		set_plan_generation_status(plan_name, payload)
		_notify_plan_generation(user, payload)


def enqueue_plan_schedule_generation(plan_name: str, *, submit: bool = True) -> dict:
	"""Queue dated flight schedule generation for a plan."""
	occurrences = validate_plan_can_generate(plan_name)
	user = frappe.session.user
	plan_title = frappe.db.get_value("Flight Schedule Plan", plan_name, "plan_title")
	set_plan_generation_status(
		plan_name,
		{
			"status": "running",
			"plan": plan_name,
			"plan_title": plan_title,
			"expected_count": occurrences,
			"processed_count": 0,
		},
	)
	frappe.enqueue(
		"bilan_sky.bilan_air_booking_system.utils.flight_schedule_plan._generate_flight_schedules_from_plan_job",
		queue="long" if occurrences > 20 else "default",
		plan_name=plan_name,
		submit=submit,
		user=user,
		job_id=f"flight-plan-gen-{plan_name}",
	)
	return {"queued": True, "plan": plan_name, "expected_count": occurrences}
