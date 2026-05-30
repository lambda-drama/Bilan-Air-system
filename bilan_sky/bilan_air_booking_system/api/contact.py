# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _
from frappe.utils import now_datetime, validate_email_address

from bilan_sky.bilan_air_booking_system.utils.portal_access import require_portal_staff


def _require_portal_user():
	if frappe.session.user == "Guest":
		frappe.throw(_("Please sign in to the portal."), frappe.PermissionError)
	require_portal_staff()


@frappe.whitelist(allow_guest=True)
def submit_contact_message(sender_name, email, message_body, phone=None, source="Website"):
	"""Store a message submitted from the public website contact form."""
	sender_name = (sender_name or "").strip()
	email = (email or "").strip().lower()
	message_body = (message_body or "").strip()
	phone = (phone or "").strip() or None
	source = (source or "Website").strip() or "Website"

	if not sender_name:
		frappe.throw(_("Your name is required."))
	if not email:
		frappe.throw(_("Email is required."))
	if not validate_email_address(email, throw=False):
		frappe.throw(_("Please enter a valid email address."))
	if not message_body:
		frappe.throw(_("Message is required."))

	submitted_by_user = None
	if frappe.session.user and frappe.session.user != "Guest":
		submitted_by_user = frappe.session.user

	ip_address = None
	if getattr(frappe.local, "request", None):
		ip_address = frappe.local.request.headers.get("X-Forwarded-For")
		if ip_address:
			ip_address = ip_address.split(",")[0].strip()
		else:
			ip_address = frappe.local.request.remote_addr

	doc = frappe.get_doc(
		{
			"doctype": "Website Contact Message",
			"sender_name": sender_name,
			"email": email,
			"phone": phone,
			"message": message_body,
			"source": source,
			"status": "New",
			"submitted_by_user": submitted_by_user,
			"ip_address": ip_address,
		}
	)
	doc.insert(ignore_permissions=True)
	frappe.db.commit()

	return {
		"name": doc.name,
		"message": _("Thank you. We received your message and will get back to you soon."),
	}


@frappe.whitelist()
def list_contact_messages(limit=50, offset=0, status=None, search=None):
	"""Portal list of website contact messages."""
	_require_portal_user()
	limit = int(limit or 50)
	offset = int(offset or 0)
	filters = {}
	if status:
		filters["status"] = status

	or_filters = None
	if search:
		q = search.strip()
		or_filters = {
			"name": ["like", f"%{q}%"],
			"sender_name": ["like", f"%{q}%"],
			"email": ["like", f"%{q}%"],
			"phone": ["like", f"%{q}%"],
			"message": ["like", f"%{q}%"],
		}

	total = frappe.db.count("Website Contact Message", filters=filters)
	data = frappe.get_all(
		"Website Contact Message",
		filters=filters,
		or_filters=or_filters,
		fields=[
			"name",
			"sender_name",
			"email",
			"phone",
			"status",
			"source",
			"message",
			"agent_reply",
			"replied_by",
			"replied_on",
			"closed_by",
			"closed_on",
			"creation",
			"modified",
		],
		order_by="creation desc",
		limit_page_length=limit,
		limit_start=offset,
	)

	return {"data": data, "total": total}


@frappe.whitelist()
def get_contact_message(name):
	_require_portal_user()
	doc = frappe.get_doc("Website Contact Message", name)
	doc.check_permission("read")
	return doc.as_dict()


@frappe.whitelist()
def set_contact_message_status(name, status):
	_require_portal_user()
	allowed = {"New", "In Progress", "Replied", "Closed"}
	status = (status or "").strip()
	if status not in allowed:
		frappe.throw(_("Invalid status."))

	doc = frappe.get_doc("Website Contact Message", name)
	doc.check_permission("write")
	doc.status = status

	if status == "Closed":
		doc.closed_by = frappe.session.user
		doc.closed_on = now_datetime()
	else:
		doc.closed_by = None
		doc.closed_on = None

	doc.save()
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def reply_to_contact_message(name, reply_body, send_email=1):
	_require_portal_user()
	reply_body = (reply_body or "").strip()
	if not reply_body:
		frappe.throw(_("Reply message is required."))

	doc = frappe.get_doc("Website Contact Message", name)
	doc.check_permission("write")

	doc.agent_reply = reply_body
	doc.replied_by = frappe.session.user
	doc.replied_on = now_datetime()
	doc.status = "Replied"

	doc.save()

	if frappe.utils.cint(send_email):
		frappe.sendmail(
			recipients=[doc.email],
			subject=_("Re: Your message to Bilan Air ({0})").format(doc.name),
			message=reply_body,
			reply_to=frappe.session.user,
		)

	frappe.db.commit()
	return doc.as_dict()
