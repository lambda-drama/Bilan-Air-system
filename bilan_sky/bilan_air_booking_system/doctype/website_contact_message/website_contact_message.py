# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import validate_email_address


class WebsiteContactMessage(Document):
	def validate(self):
		self.sender_name = (self.sender_name or "").strip()
		self.email = (self.email or "").strip().lower()
		self.phone = (self.phone or "").strip()
		self.message = (self.message or "").strip()

		if not self.sender_name:
			frappe.throw(_("Sender name is required."))
		if not self.email:
			frappe.throw(_("Email is required."))
		if not validate_email_address(self.email, throw=False):
			frappe.throw(_("Please enter a valid email address."))
		if not self.message:
			frappe.throw(_("Message is required."))
