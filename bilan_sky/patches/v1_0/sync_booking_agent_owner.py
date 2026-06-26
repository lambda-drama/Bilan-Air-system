import frappe


def execute():
	"""Set Booking Agent owner to the linked portal user so if_owner role rules apply."""
	if not frappe.db.table_exists("tabBooking Agent"):
		return

	for row in frappe.get_all("Booking Agent", fields=["name", "user", "owner"]):
		user = (row.get("user") or "").strip()
		if not user or row.get("owner") == user:
			continue
		frappe.db.set_value("Booking Agent", row["name"], "owner", user, update_modified=False)

	frappe.db.commit()
