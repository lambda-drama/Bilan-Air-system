# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class BookingAgent(Document):
	def validate(self):
		self._sync_credit_flags()
		if self.confirmation_mode == "Booking Only":
			self.credit_limit = 0
			self.allow_credit = 0

	def _sync_credit_flags(self):
		if self.confirmation_mode == "Booking Only":
			self.allow_credit = 0
			return
		if flt(self.credit_limit) <= 0:
			self.allow_credit = 0
			return
		if flt(self.credit_used) >= flt(self.credit_limit):
			self.allow_credit = 0

	def credit_available(self) -> float:
		if self.confirmation_mode != "Credit Agent":
			return 0.0
		return max(0.0, flt(self.credit_limit) - flt(self.credit_used))

	def can_confirm_on_credit(self, amount: float = 0) -> bool:
		if self.status != "Active":
			return False
		if self.confirmation_mode != "Credit Agent":
			return False
		if not self.allow_credit:
			return False
		if flt(self.credit_limit) <= 0:
			return False
		if amount and flt(amount) > self.credit_available():
			return False
		return flt(self.credit_used) < flt(self.credit_limit)

	def consume_credit(self, amount: float):
		"""Increase credit_used after a booking is confirmed on credit."""
		amount = flt(amount)
		if amount <= 0:
			frappe.throw(_("Cannot apply zero credit to a booking."))
		if not self.can_confirm_on_credit(amount):
			frappe.throw(
				_(
					"Credit limit reached or credit confirmation is disabled for {0}. "
					"Available: {1}, requested: {2}."
				).format(
					self.agent_name,
					frappe.format(self.credit_available(), {"fieldtype": "Currency"}),
					frappe.format(amount, {"fieldtype": "Currency"}),
				)
			)

		self.credit_used = flt(self.credit_used) + amount
		self._sync_credit_flags()
		self.save(ignore_permissions=True)
