import frappe

from bilan_sky.bilan_air_booking_system.utils.booking_agent import (
	create_booking_agent_profile,
	default_credit_limit,
)


def execute():
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	role_users = frappe.get_all(
		"Has Role",
		filters={"role": "Booking Agent", "parenttype": "User"},
		pluck="parent",
	)
	for user in role_users:
		if frappe.db.exists("Booking Agent", {"user": user}):
			continue
		full_name = frappe.db.get_value("User", user, "full_name") or user
		email = frappe.db.get_value("User", user, "email")
		phone = frappe.db.get_value("User", user, "mobile_no")
		create_booking_agent_profile(
			user=user,
			agent_name=full_name,
			email=email,
			phone=phone,
			confirmation_mode="Credit Agent",
			credit_limit=default_credit_limit(),
		)
	frappe.db.commit()
