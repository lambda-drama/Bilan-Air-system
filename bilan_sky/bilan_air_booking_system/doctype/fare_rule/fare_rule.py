# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class FareRule(Document):
	def validate(self):
		if self.days_before_departure is not None and self.days_before_departure < 0:
			frappe.throw(_("Days before departure cannot be negative"))

		if self.price_increase_percentage is not None and self.price_increase_percentage < 0:
			frappe.throw(_("Price increase percentage cannot be negative"))
