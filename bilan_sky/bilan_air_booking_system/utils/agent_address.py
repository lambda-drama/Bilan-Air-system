"""Create and read ERPNext Address records linked to portal users."""

import frappe
from frappe import _
from frappe.utils import cstr

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting


def default_address_country() -> str:
	country = cstr(get_ba_setting("default_address_country", "")).strip()
	if country and frappe.db.exists("Country", country):
		return country
	global_default = cstr(frappe.defaults.get_global_default("country")).strip()
	if global_default and frappe.db.exists("Country", global_default):
		return global_default
	if frappe.db.exists("Country", "Kenya"):
		return "Kenya"
	return frappe.db.get_value("Country", {}, "name", order_by="name asc") or ""


def get_agent_address_name(user: str | None) -> str | None:
	if not user:
		return None
	if frappe.db.has_column("Address", "custom_user"):
		name = frappe.db.get_value("Address", {"custom_user": user}, "name", order_by="modified desc")
		if name:
			return name
	return frappe.db.sql(
		"""
		select dl.parent
		from `tabDynamic Link` dl
		inner join `tabAddress` a on a.name = dl.parent
		where dl.link_doctype = 'User' and dl.link_name = %s and dl.parenttype = 'Address'
		order by a.modified desc
		limit 1
		""",
		user,
	)


def get_agent_address_fields(user: str | None) -> dict:
	name = get_agent_address_name(user)
	if not name:
		return {}
	row = frappe.db.get_value(
		"Address",
		name,
		["name", "address_line1", "address_line2", "city", "phone", "email_id", "country"],
		as_dict=True,
	)
	return row or {}


def create_or_update_agent_address(
	user: str,
	*,
	company_name: str,
	email: str,
	address_line1: str,
	city: str,
	phone: str | None = None,
	address_line2: str | None = None,
	country: str | None = None,
) -> str:
	"""Create or update the primary Address for a booking agent user."""
	if not user:
		frappe.throw(_("User is required to create an address."))
	address_line1 = cstr(address_line1).strip()
	city = cstr(city).strip()
	if not address_line1:
		frappe.throw(_("Address line 1 is required."))
	if not city:
		frappe.throw(_("City is required."))

	country = cstr(country).strip() or default_address_country()
	if not country:
		frappe.throw(_("Default country is not configured. Set default_address_country in BA Settings."))

	existing = get_agent_address_name(user)
	payload = {
		"address_title": (company_name or user).strip() or user,
		"address_type": "Office",
		"address_line1": address_line1,
		"address_line2": cstr(address_line2).strip() or None,
		"city": city,
		"country": country,
		"email_id": cstr(email).strip() or None,
		"phone": cstr(phone).strip() or None,
		"links": [{"link_doctype": "User", "link_name": user}],
	}
	if frappe.db.has_column("Address", "custom_user"):
		payload["custom_user"] = user

	if existing:
		doc = frappe.get_doc("Address", existing)
		doc.update(payload)
		doc.save(ignore_permissions=True)
		return doc.name

	doc = frappe.get_doc({"doctype": "Address", **payload})
	doc.insert(ignore_permissions=True)
	return doc.name
