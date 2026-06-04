import frappe

from bilan_sky.bilan_air_booking_system.utils.reservation_status import (
	BOOKED,
	ensure_default_statuses,
	map_legacy_status,
)


def execute():
	ensure_default_statuses()

	if not frappe.db.table_exists("tabAir Booking"):
		return

	if frappe.db.has_column("Air Booking", "_legacy_booking_status"):
		rows = frappe.db.sql(
			"""
			SELECT name, `_legacy_booking_status` AS legacy_status
			FROM `tabAir Booking`
			WHERE `_legacy_booking_status` IS NOT NULL AND `_legacy_booking_status` != ''
			""",
			as_dict=True,
		)
		for row in rows:
			new_status = map_legacy_status(row.legacy_status)
			frappe.db.set_value(
				"Air Booking",
				row.name,
				"reservation_status",
				new_status,
				update_modified=False,
			)
		frappe.db.sql(
			"ALTER TABLE `tabAir Booking` DROP COLUMN `_legacy_booking_status`"
		)
	elif frappe.db.has_column("Air Booking", "booking_status"):
		rows = frappe.db.sql(
			"""
			SELECT name, booking_status AS legacy_status
			FROM `tabAir Booking`
			WHERE booking_status IS NOT NULL AND booking_status != ''
			""",
			as_dict=True,
		)
		for row in rows:
			new_status = map_legacy_status(row.legacy_status)
			frappe.db.set_value(
				"Air Booking",
				row.name,
				"reservation_status",
				new_status,
				update_modified=False,
			)

	if frappe.db.has_column("Air Booking", "reservation_status"):
		frappe.db.sql(
			"""
			UPDATE `tabAir Booking`
			SET reservation_status = %s
			WHERE reservation_status IS NULL OR reservation_status = ''
			""",
			(BOOKED,),
		)

	frappe.db.commit()
