"""Enable portal users after they complete the welcome / set-password flow."""

import frappe
from frappe import _
from frappe.utils import cint


def user_has_set_password(user: str) -> bool:
	"""True once the user has completed an initial password setup."""
	return bool(frappe.db.get_value("User", user, "last_password_reset_date"))


def booking_agent_user_should_be_enabled(agent) -> bool:
	"""Portal login only when the agent profile is Active and the user finished activation."""
	if not agent or not agent.user:
		return False
	if agent.status != "Active":
		return False
	return user_has_set_password(agent.user)


def sync_booking_agent_user_enabled(agent) -> None:
	"""Keep User.enabled aligned with agent status + password activation."""
	if not agent.user:
		return
	enabled = 1 if booking_agent_user_should_be_enabled(agent) else 0
	if cint(frappe.db.get_value("User", agent.user, "enabled")) != enabled:
		frappe.db.set_value("User", agent.user, "enabled", enabled, update_modified=False)


def on_user_update(doc, method=None):
	"""After first password setup, enable login when the Booking Agent profile is Active."""
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


def send_user_activation_email(user: str) -> None:
	"""Send (or resend) the welcome / set-password email."""
	user_doc = frappe.get_doc("User", user)
	if user_doc.name in ("Administrator", "Guest"):
		frappe.throw(_("Cannot send activation for this user."))
	user_doc.flags.no_welcome_mail = False
	user_doc.send_welcome_mail_to_user()
	frappe.db.set_value("User", user, "send_welcome_email", 1, update_modified=False)
