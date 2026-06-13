import frappe
from frappe.utils import cint


def execute():
	for name in frappe.get_all("Flight Schedule", pluck="name"):
		if not cint(frappe.db.get_value("Flight Schedule", name, "is_active")):
			frappe.db.set_value("Flight Schedule", name, "is_active", 1, update_modified=False)
	frappe.db.commit()
