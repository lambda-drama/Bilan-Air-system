import frappe

PASSENGER_CUSTOMER_GROUP = "Passenger"


def ensure_passenger_customer_group():
	"""Create Customer Group 'Passenger' if it does not exist."""
	if frappe.db.exists("Customer Group", PASSENGER_CUSTOMER_GROUP):
		return PASSENGER_CUSTOMER_GROUP

	parent = "All Customer Groups"
	if not frappe.db.exists("Customer Group", parent):
		parent = frappe.db.get_value(
			"Customer Group",
			{"is_group": 1, "parent_customer_group": ["is", "not set"]},
			"name",
		)

	frappe.get_doc(
		{
			"doctype": "Customer Group",
			"customer_group_name": PASSENGER_CUSTOMER_GROUP,
			"parent_customer_group": parent,
			"is_group": 0,
		}
	).insert(ignore_permissions=True)

	return PASSENGER_CUSTOMER_GROUP
