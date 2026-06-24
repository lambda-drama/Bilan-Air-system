"""Booking agent portal user enablement and activation emails."""

import frappe
from frappe import _
from frappe.utils import cint


def user_has_set_password(user: str) -> bool:
	"""True once the user has completed an initial password setup."""
	return bool(frappe.db.get_value("User", user, "last_password_reset_date"))


def booking_agent_user_should_be_enabled(agent) -> bool:
	"""Portal login when the agent profile is Active."""
	if not agent or not agent.user:
		return False
	return agent.status == "Active"


def sync_booking_agent_user_enabled(agent) -> None:
	"""Keep User.enabled aligned with Booking Agent status."""
	if not agent.user:
		return
	enabled = 1 if booking_agent_user_should_be_enabled(agent) else 0
	if cint(frappe.db.get_value("User", agent.user, "enabled")) != enabled:
		frappe.db.set_value("User", agent.user, "enabled", enabled, update_modified=False)


def on_user_update(doc, method=None):
	"""Re-sync User.enabled when a booking agent finishes password setup."""
	if not doc.name or doc.name in ("Administrator", "Guest"):
		return
	if not doc.has_value_changed("last_password_reset_date") or not doc.last_password_reset_date:
		return
	if not frappe.db.exists("Booking Agent", {"user": doc.name}):
		return
	agent_name = frappe.db.get_value("Booking Agent", {"user": doc.name}, "name")
	if not agent_name:
		return
	agent = frappe.get_doc("Booking Agent", agent_name)
	sync_booking_agent_user_enabled(agent)


def _booking_agent_activation_args(user_doc) -> dict:
	from frappe.utils import get_url
	from frappe.utils.user import get_user_fullname

	booking_agent = frappe.db.get_value(
		"Booking Agent",
		{"user": user_doc.name},
		["username"],
		as_dict=True,
	)
	username = (booking_agent or {}).get("username") or user_doc.name
	site_name = (
		frappe.db.get_default("site_name")
		or frappe.get_conf().get("site_name")
		or "Bilan Air"
	)
	created_by = get_user_fullname(frappe.session.get("user") or "Administrator")
	if created_by == "Guest":
		created_by = "Administrator"

	return {
		"first_name": user_doc.first_name or user_doc.last_name or _("there"),
		"last_name": user_doc.last_name or "",
		"user": user_doc.name,
		"username": username,
		"login_url": get_url("/portal/login"),
		"site_name": site_name,
		"created_by": created_by,
	}


def send_user_activation_email(user: str) -> None:
	"""Send (or resend) the booking agent activation / set-password email."""
	user_doc = frappe.get_doc("User", user)
	if user_doc.name in ("Administrator", "Guest"):
		frappe.throw(_("Cannot send activation for this user."))

	link = user_doc._reset_password()
	args = _booking_agent_activation_args(user_doc)
	args["link"] = link
	subject = _("Activate your {0} booking agent account").format(args["site_name"])

	frappe.sendmail(
		recipients=user_doc.email,
		subject=subject,
		template="booking_agent_activation",
		args=args,
		header=[subject, "green"],
		delayed=False,
		retry=3,
	)
	frappe.db.set_value("User", user, "send_welcome_email", 1, update_modified=False)
