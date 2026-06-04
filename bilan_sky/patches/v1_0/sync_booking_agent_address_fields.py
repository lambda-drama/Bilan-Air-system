"""Backfill booking agent contact/address fields and ERPNext Address links."""

import frappe

from bilan_sky.bilan_air_booking_system.utils.agent_address import (
	create_or_update_agent_address,
	get_agent_address_name,
)


def execute():
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	for row in frappe.get_all(
		"Booking Agent",
		fields=[
			"name",
			"user",
			"agent_name",
			"username",
			"first_name",
			"last_name",
			"email",
			"phone",
			"city",
			"address_line1",
			"address_line2",
			"agent_address",
		],
	):
		if not row.user:
			continue
		user = frappe.db.get_value(
			"User",
			row.user,
			["first_name", "last_name", "email", "mobile_no"],
			as_dict=True,
		)
		if not user:
			continue

		updates = {}
		if not (row.first_name or "").strip():
			updates["first_name"] = user.first_name or "Agent"
		if not (row.last_name or "").strip():
			updates["last_name"] = user.last_name or ""
		if not (row.email or "").strip():
			updates["email"] = user.email
		if not (row.phone or "").strip():
			updates["phone"] = user.mobile_no or ""
		if not (row.username or "").strip():
			updates["username"] = row.agent_name or row.user

		addr_name = row.agent_address or get_agent_address_name(row.user)
		if addr_name:
			addr = frappe.db.get_value(
				"Address",
				addr_name,
				["address_line1", "address_line2", "city"],
				as_dict=True,
			)
			if addr:
				if not (row.address_line1 or "").strip() and addr.address_line1:
					updates["address_line1"] = addr.address_line1
				if not (row.address_line2 or "").strip() and addr.address_line2:
					updates["address_line2"] = addr.address_line2
				if not (row.city or "").strip() and addr.city:
					updates["city"] = addr.city
				if not row.agent_address:
					updates["agent_address"] = addr_name

		if updates:
			frappe.db.set_value("Booking Agent", row.name, updates, update_modified=False)

		row = {**row, **updates}
		if (
			row.user
			and (row.address_line1 or "").strip()
			and (row.city or "").strip()
			and not row.agent_address
		):
			address_name = create_or_update_agent_address(
				row.user,
				company_name=row.agent_name,
				email=row.email or user.email,
				address_line1=row.address_line1,
				address_line2=row.address_line2,
				city=row.city,
				phone=row.phone,
			)
			frappe.db.set_value(
				"Booking Agent",
				row.name,
				{"agent_address": address_name},
				update_modified=False,
			)

	frappe.db.commit()
