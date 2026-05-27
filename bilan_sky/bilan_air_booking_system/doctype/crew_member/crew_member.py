# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from bilan_sky.bilan_air_booking_system.utils.user_accounts import create_or_get_user

DEFAULT_USER_ROLE = "Crew Member"


class CrewMember(Document):
	def validate(self):
		if not self.user and not self.email:
			frappe.throw(_("Email is required to create a login user for this crew member."))

	def after_insert(self):
		if not self.user:
			self._create_and_link_user()

	def _create_and_link_user(self):
		user_name = create_or_get_user(
			self.email,
			self.full_name,
			mobile_no=self.phone_number,
			enabled=self.status != "Inactive",
			role=DEFAULT_USER_ROLE,
			default_first_name="Crew Member",
		)
		if not user_name:
			return

		self.db_set("user", user_name, update_modified=False)
		self.user = user_name
