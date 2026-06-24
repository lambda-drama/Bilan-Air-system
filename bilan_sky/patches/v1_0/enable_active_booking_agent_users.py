"""Enable portal users linked to Active booking agents."""

import frappe

from bilan_sky.bilan_air_booking_system.utils.user_activation import (
	sync_booking_agent_user_enabled,
)


def execute():
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	for name in frappe.get_all("Booking Agent", pluck="name"):
		sync_booking_agent_user_enabled(frappe.get_doc("Booking Agent", name))

	frappe.db.commit()
