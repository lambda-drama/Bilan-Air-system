import frappe

from bilan_sky.bilan_air_booking_system.utils.reservation_status import ensure_default_statuses


def execute():
	ensure_default_statuses()

	# Legacy rows used document name as PNR before RES-/BA- split.
	if not frappe.db.table_exists("tabAir Booking"):
		return

	if frappe.db.has_column("Air Booking", "reservation_ref"):
		frappe.db.sql(
			"""
			UPDATE `tabAir Booking`
			SET reservation_ref = name
			WHERE reservation_ref IS NULL OR reservation_ref = ''
			"""
		)

	for status in ("Confirm", "Flight Taken"):
		frappe.db.sql(
			"""
			UPDATE `tabAir Booking`
			SET pnr = name
			WHERE reservation_status = %s
			  AND (pnr IS NULL OR pnr = '')
			  AND name LIKE 'BA-%%'
			""",
			(status,),
		)

	if frappe.db.has_column("BA Settings", "pnr_naming_series"):
		if not frappe.db.get_single_value("BA Settings", "pnr_naming_series"):
			frappe.db.set_single_value("BA Settings", "pnr_naming_series", "BA-.#####")
		if not frappe.db.get_single_value("BA Settings", "reservation_naming_series"):
			frappe.db.set_single_value("BA Settings", "reservation_naming_series", "RES-.#####")

	frappe.db.commit()
