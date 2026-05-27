import frappe


def execute():
	"""Copy names from linked Passenger records into Air Booking Passenger rows."""
	if not frappe.db.has_column("Air Booking Passenger", "passenger_name"):
		return

	rows = frappe.db.sql(
		"""
		select name, passenger
		from `tabAir Booking Passenger`
		where ifnull(passenger_name, '') = '' and ifnull(passenger, '') != ''
		""",
		as_dict=True,
	)

	for row in rows:
		full_name = frappe.db.get_value("Passenger", row.passenger, "full_name")
		if full_name:
			frappe.db.set_value(
				"Air Booking Passenger",
				row.name,
				"passenger_name",
				full_name,
				update_modified=False,
			)
