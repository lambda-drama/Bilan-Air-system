import frappe


def execute():
	"""Preserve legacy booking_status values before field migration."""
	if not frappe.db.table_exists("tabAir Booking"):
		return
	if not frappe.db.has_column("Air Booking", "booking_status"):
		return
	if frappe.db.has_column("Air Booking", "_legacy_booking_status"):
		return

	frappe.db.sql(
		"""
		ALTER TABLE `tabAir Booking`
		ADD COLUMN `_legacy_booking_status` VARCHAR(140)
		"""
	)
	frappe.db.sql(
		"""
		UPDATE `tabAir Booking`
		SET `_legacy_booking_status` = `booking_status`
		WHERE `booking_status` IS NOT NULL AND `booking_status` != ''
		"""
	)
	frappe.db.commit()
