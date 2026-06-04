"""Booking agent profile helpers (credit limit, portal user mapping)."""

import frappe
from frappe.utils import flt

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting


def default_credit_limit() -> float:
	return flt(get_ba_setting("default_agent_credit_limit", 0))


def get_booking_agent_for_user(user: str | None = None):
	user = user or frappe.session.user
	if not user or user == "Guest":
		return None
	name = frappe.db.get_value("Booking Agent", {"user": user, "status": "Active"})
	if not name:
		return None
	return frappe.get_doc("Booking Agent", name)


def booking_agent_row_for_user(user: str | None = None) -> dict | None:
	agent = get_booking_agent_for_user(user)
	if not agent:
		return None
	return serialize_booking_agent(agent)


def serialize_booking_agent(agent) -> dict:
	full_name = " ".join(
		p for p in (getattr(agent, "first_name", None), getattr(agent, "last_name", None)) if p
	).strip()
	return {
		"name": agent.name,
		"agent_name": agent.agent_name,
		"username": getattr(agent, "username", None),
		"first_name": getattr(agent, "first_name", None),
		"last_name": getattr(agent, "last_name", None),
		"full_name": full_name or None,
		"user": agent.user,
		"email": agent.email,
		"phone": agent.phone,
		"phone_2": getattr(agent, "phone_2", None),
		"agent_address": getattr(agent, "agent_address", None),
		"address_line1": getattr(agent, "address_line1", None),
		"address_line2": getattr(agent, "address_line2", None),
		"city": getattr(agent, "city", None),
		"status": agent.status,
		"confirmation_mode": agent.confirmation_mode,
		"credit_limit": flt(agent.credit_limit),
		"credit_used": flt(agent.credit_used),
		"credit_available": agent.credit_available(),
		"allow_credit": agent.allow_credit,
		"can_confirm_on_credit": agent.can_confirm_on_credit(),
		"linked_customer": agent.linked_customer,
		"notes": agent.notes,
	}


def create_booking_agent_profile(
	user: str,
	agent_name: str,
	email: str | None = None,
	phone: str | None = None,
	confirmation_mode: str = "Credit Agent",
	credit_limit: float | None = None,
	linked_customer: str | None = None,
	notes: str | None = None,
	*,
	username: str | None = None,
	first_name: str | None = None,
	last_name: str | None = None,
	phone_2: str | None = None,
	agent_address: str | None = None,
	address_line1: str | None = None,
	address_line2: str | None = None,
	city: str | None = None,
):
	"""Create or update the Booking Agent profile for a portal user."""
	agent_name = (agent_name or "").strip()
	if not agent_name:
		frappe.throw("Agent name is required.")
	if frappe.db.exists("Booking Agent", {"agent_name": agent_name, "user": ["!=", user]}):
		agent_name = f"{agent_name} ({email or user})"

	existing = frappe.db.get_value("Booking Agent", {"user": user}, "name")
	limit = flt(credit_limit) if credit_limit is not None else default_credit_limit()
	mode = (confirmation_mode or "Credit Agent").strip()
	if mode not in ("Credit Agent", "Booking Only"):
		frappe.throw("Invalid confirmation mode.")

	payload = {
		"agent_name": agent_name,
		"username": (username or "").strip() or agent_name,
		"first_name": (first_name or "").strip(),
		"last_name": (last_name or "").strip(),
		"user": user,
		"email": email,
		"phone": phone,
		"phone_2": phone_2,
		"agent_address": agent_address,
		"address_line1": address_line1,
		"address_line2": address_line2,
		"city": city,
		"confirmation_mode": mode,
		"credit_limit": limit if mode == "Credit Agent" else 0,
		"allow_credit": 1 if mode == "Credit Agent" and limit > 0 else 0,
		"linked_customer": linked_customer,
		"notes": notes,
		"status": "Active",
	}

	if existing:
		doc = frappe.get_doc("Booking Agent", existing)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Booking Agent", **payload})
		doc.insert(ignore_permissions=True)

	return doc


def validate_credit_confirmation_for_booking(booking, user: str | None = None):
	"""Ensure the current user may confirm this fare on agent credit."""
	agent = get_booking_agent_for_user(user)
	if not agent:
		frappe.throw(
			"No active Booking Agent profile is linked to your user. "
			"Ask an administrator to configure your agent account.",
			title="Booking agent profile missing",
		)
	if not agent.can_confirm_on_credit(flt(booking.total_fare)):
		frappe.throw(
			f"Cannot confirm on credit for {agent.agent_name}. "
			f"Mode: {agent.confirmation_mode}. "
			f"Available credit: {frappe.format(agent.credit_available(), {'fieldtype': 'Currency'})}.",
			title="Credit limit exceeded",
		)
	return agent


def finalize_credit_confirmation(booking, agent, user: str | None = None):
	"""Consume credit after PNR is issued."""
	if agent is None:
		agent = get_booking_agent_for_user(user)
	if not agent:
		return
	agent.consume_credit(flt(booking.total_fare))
	booking.booking_agent = agent.name
	booking.confirmed_via = "Agent Credit"
	frappe.db.set_value(
		"Air Booking",
		booking.name,
		{"booking_agent": agent.name, "confirmed_via": "Agent Credit"},
		update_modified=True,
	)
