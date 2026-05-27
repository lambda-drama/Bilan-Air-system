# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cstr


class BaggageTracking(Document):
	def autoname(self):
		self.tracking_number = self._generate_tracking_number()
		self.name = self.tracking_number

	def validate(self):
		if self.name:
			self.tracking_number = self.name
		elif self.air_booking:
			self.tracking_number = self._generate_tracking_number()

	def _generate_tracking_number(self) -> str:
		if not self.air_booking:
			frappe.throw(_("Air Booking (PNR) is required to generate a tracking number."))

		pnr = frappe.db.get_value("Air Booking", self.air_booking, "pnr") or self.air_booking
		pnr = cstr(pnr).strip()

		filters = {"air_booking": self.air_booking}
		if self.name and not self.is_new():
			filters["name"] = ["!=", self.name]

		sequence = frappe.db.count("Baggage Tracking", filters) + 1
		return f"{sequence:03d}-{pnr}"
