# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class BookingAgent(Document):
	def before_insert(self):
		self._apply_agent_profile_name()
		if self.user:
			self.owner = self.user

	def validate(self):
		self._apply_agent_profile_name()
		self._sync_rights_mode()
		self._sync_credit_flags()

	def _apply_agent_profile_name(self):
		from bilan_sky.bilan_air_booking_system.utils.booking_agent import (
			resolve_agent_profile_name,
		)

		if not self.booking_company:
			if self.is_new() and not (self.agent_name or "").strip():
				frappe.throw(_("Company / Agency is required."))
			return

		self.agent_name = resolve_agent_profile_name(
			self.booking_company,
			username=self.username,
			email=self.email,
			user=self.user,
			exclude_name=self.name if not self.is_new() else None,
		)

	def _sync_rights_mode(self):
		"""Derive confirmation_mode from explicit user-rights fields."""
		if self.can_confirm_ticket == "No":
			self.confirmation_mode = "Booking Only"
			self.credit_limit = 0
			self.allow_credit = 0
			return

		if self.deposit_required == "Yes" or flt(self.credit_limit) <= 0:
			self.confirmation_mode = "Booking Only"
			return

		self.confirmation_mode = "Credit Agent"

	def _sync_credit_flags(self):
		if self.confirmation_mode == "Booking Only":
			self.allow_credit = 0
			return
		if flt(self.credit_limit) <= 0:
			self.allow_credit = 0
			return
		if flt(self.credit_used) >= flt(self.credit_limit):
			self.allow_credit = 0

	def is_active(self) -> bool:
		return self.status == "Active"

	def allows_booking(self) -> bool:
		return self.is_active() and self.can_book_ticket == "Yes"

	def allows_confirmation(self) -> bool:
		return self.is_active() and self.can_confirm_ticket == "Yes"

	def requires_deposit_for_confirmation(self) -> bool:
		return self.deposit_required == "Yes"

	def credit_available(self) -> float:
		if self.confirmation_mode != "Credit Agent":
			return 0.0
		return max(0.0, flt(self.credit_limit) - flt(self.credit_used))

	def can_confirm_on_credit(self, amount: float = 0) -> bool:
		if not self.allows_confirmation():
			return False
		if self.requires_deposit_for_confirmation():
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


@frappe.whitelist()
def get_agent_profile_name(
	booking_company,
	username=None,
	email=None,
	user=None,
	docname=None,
):
	"""Desk/portal: preview profile name before save (autoname field)."""
	frappe.has_permission("Booking Agent", "write", throw=True)
	from bilan_sky.bilan_air_booking_system.utils.booking_agent import resolve_agent_profile_name

	return resolve_agent_profile_name(
		booking_company,
		username=username,
		email=email,
		user=user,
		exclude_name=docname or None,
	)
