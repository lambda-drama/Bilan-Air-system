# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class AirBookingPassenger(Document):
	def validate(self):
		if self.passenger:
			profile = frappe.get_doc("Passenger", self.passenger)
			if not self.passenger_name:
				self.passenger_name = profile.full_name
			if not self.id_number and profile.id_number:
				self.id_number = profile.id_number
			if not self.passenger_type:
				self.passenger_type = profile.passenger_type

		elif self.id_number:
			existing = frappe.db.get_value(
				"Passenger",
				{"id_number": self.id_number},
				["name", "full_name", "passenger_type"],
				as_dict=True,
			)
			if existing:
				self.passenger = existing.name
				if not self.passenger_name:
					self.passenger_name = existing.full_name
				if not self.passenger_type:
					self.passenger_type = existing.passenger_type
