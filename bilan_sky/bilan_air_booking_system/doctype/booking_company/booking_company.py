# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class BookingCompany(Document):
	def validate(self):
		self.company_agency = (self.company_agency or "").strip()
		if not self.company_agency:
			frappe.throw(_("Company or agency name is required."))
