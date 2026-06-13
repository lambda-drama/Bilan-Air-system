# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class SeatClass(Document):
	def validate(self):
		if self.use_on_aircraft_layout and self.cabin_class:
			duplicate = frappe.db.exists(
				"Seat Class",
				{
					"cabin_class": self.cabin_class,
					"use_on_aircraft_layout": 1,
					"name": ["!=", self.name],
				},
			)
			if duplicate:
				cabin_name = frappe.db.get_value("Cabin Class", self.cabin_class, "cabin_name")
				frappe.throw(
					_(
						"Only one layout seat class is allowed per cabin. {0} already has a layout class ({1})."
					).format(cabin_name, duplicate)
				)
