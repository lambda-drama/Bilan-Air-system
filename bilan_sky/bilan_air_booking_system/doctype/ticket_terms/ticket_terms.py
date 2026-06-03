# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class TicketTerms(Document):
	def validate(self):
		if not (self.title or "").strip():
			frappe.throw(_("Title is required"))

		if self.default:
			frappe.db.sql(
				"""
				UPDATE `tabTicket Terms`
				SET `default` = 0
				WHERE name != %s
				""",
				self.name or "",
			)
