# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, getdate

from bilan_sky.bilan_air_booking_system.utils.flight_schedule_plan import (
	count_plan_occurrences,
)


class FlightSchedulePlan(Document):
	def before_insert(self):
		if not (self.plan_title or "").strip():
			from bilan_sky.bilan_air_booking_system.utils.flight_schedule_plan import next_plan_title

			self.plan_title = next_plan_title()

	def validate(self):
		from bilan_sky.bilan_air_booking_system.utils.crew_filters import validate_flight_crew_pilots
		validate_flight_crew_pilots(self)

		if getdate(self.end_date) < getdate(self.start_date):
			frappe.throw(_("End Date cannot be before Start Date."))
		if self.frequency == "Weekly":
			if not any(cint(self.get(day)) for day, _ in (
				("sunday", 6),
				("monday", 0),
				("tuesday", 1),
				("wednesday", 2),
				("thursday", 3),
				("friday", 4),
				("saturday", 5),
			)):
				frappe.throw(_("Select at least one weekday for a weekly plan."))
		if self.frequency == "Monthly" and not cint(self.monthly_day):
			self.monthly_day = getdate(self.start_date).day
		self._validate_plan_seat_classes()

	def _validate_plan_seat_classes(self):
		if not self.seat_classes or not self.airplane:
			return
		from bilan_sky.bilan_air_booking_system.utils.seat_release import layout_seat_counts_by_class

		layout_caps = layout_seat_counts_by_class(self.airplane)
		for row in self.seat_classes:
			if not row.seat_class:
				continue
			qty = cint(row.number_of_seats)
			if qty <= 0:
				continue
			cap = layout_caps.get(row.seat_class, 0)
			if qty > cap:
				label = frappe.db.get_value("Seat Class", row.seat_class, "class_name") or row.seat_class
				frappe.throw(
					_("{0}: cannot release {1} seats — airplane layout only has {2} for this class.").format(
						label, qty, cap
					)
				)

	def generate_schedules(self, submit: bool = True):
		from bilan_sky.bilan_air_booking_system.utils.flight_schedule_plan import (
			generate_flight_schedules_from_plan,
		)

		return generate_flight_schedules_from_plan(self.name, submit=submit)

	def preview_occurrence_count(self) -> int:
		return count_plan_occurrences(self)
