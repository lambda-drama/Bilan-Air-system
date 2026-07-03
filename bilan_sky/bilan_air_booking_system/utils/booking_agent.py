"""Booking agent profile helpers (credit limit, portal user mapping)."""

import frappe
from frappe import _
from frappe.utils import cint, flt

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting
from bilan_sky.bilan_air_booking_system.utils.booking_company import enrich_agent_company_fields


def default_credit_limit() -> float:
	return flt(get_ba_setting("default_agent_credit_limit", 0))


def booking_agent_activation_by_email() -> bool:
	"""True when new agents should receive a set-password email instead of staff setting a password."""
	return bool(cint(get_ba_setting("send_booking_agent_activation_email", 1)))


def resolve_agent_profile_name(
	booking_company: str,
	*,
	username: str | None = None,
	email: str | None = None,
	user: str | None = None,
	exclude_name: str | None = None,
) -> str:
	"""Build unique profile name (document ID) from company + username."""
	booking_company = (booking_company or "").strip()
	if not booking_company:
		frappe.throw(_("Company / Agency is required."))

	company_name = frappe.db.get_value("Booking Company", booking_company, "company_agency")
	if not company_name:
		frappe.throw(_("Selected company or agency was not found."))

	base = company_name.strip()
	candidate = base
	username = (username or "").strip()
	filters: dict = {"agent_name": candidate}
	if exclude_name:
		filters["name"] = ["!=", exclude_name]
	if frappe.db.exists("Booking Agent", filters):
		candidate = f"{base} ({username or email or user or 'agent'})"
	return candidate


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


def _activation_pending(agent) -> bool:
	if not agent.user:
		return False
	from bilan_sky.bilan_air_booking_system.utils.user_activation import user_has_set_password

	return not user_has_set_password(agent.user)


def serialize_booking_agent(agent) -> dict:
	user_role_profile = None
	user_roles = []
	if getattr(agent, "user", None) and frappe.db.exists("User", agent.user):
		user_role_profile = frappe.db.get_value("User", agent.user, "role_profile_name")
		user_doc = frappe.get_doc("User", agent.user)
		user_roles = [r.role for r in user_doc.roles]

	full_name = " ".join(
		p for p in (getattr(agent, "first_name", None), getattr(agent, "last_name", None)) if p
	).strip()
	row = {
		"name": agent.name,
		"booking_company": getattr(agent, "booking_company", None),
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
		"role_profile_name": user_role_profile,
		"roles": user_roles,
		"user_type": getattr(agent, "user_type", "Agent"),
		"can_book_ticket": getattr(agent, "can_book_ticket", "Yes"),
		"can_confirm_ticket": getattr(agent, "can_confirm_ticket", "Yes"),
		"deposit_required": getattr(agent, "deposit_required", "No"),
		"confirmation_mode": agent.confirmation_mode,
		"credit_limit": flt(agent.credit_limit),
		"credit_used": flt(agent.credit_used),
		"credit_available": agent.credit_available(),
		"allow_credit": agent.allow_credit,
		"allows_booking": agent.allows_booking(),
		"allows_confirmation": agent.allows_confirmation(),
		"can_confirm_on_credit": agent.can_confirm_on_credit(),
		"activation_pending": _activation_pending(agent),
		"linked_customer": agent.linked_customer,
		"notes": agent.notes,
		"role_profile_name": frappe.db.get_value("User", agent.user, "role_profile_name")
		if getattr(agent, "user", None)
		else None,
	}
	return enrich_agent_company_fields(row)


def sync_booking_agent_user_enabled(agent) -> None:
	from bilan_sky.bilan_air_booking_system.utils.user_activation import (
		sync_booking_agent_user_enabled as _sync,
	)

	_sync(agent)


def validate_agent_can_create_booking(user: str | None = None):
	agent = get_booking_agent_for_user(user)
	if not agent:
		return None
	if not agent.allows_booking():
		frappe.throw(
			_("Your booking agent profile is not allowed to create reservations."),
			title=_("Booking not permitted"),
		)
	return agent


def resolve_credit_agent_for_confirmation(booking, user: str | None = None):
	"""Logged-in agent, else Booking Agent set on the reservation (Desk staff)."""
	user = user or frappe.session.user
	agent = get_booking_agent_for_user(user)
	if agent:
		return agent

	booking_agent = (getattr(booking, "booking_agent", None) or "").strip()
	if booking_agent and frappe.db.exists("Booking Agent", booking_agent):
		return frappe.get_doc("Booking Agent", booking_agent)

	frappe.throw(
		_(
			"No Booking Agent on this reservation and your user is not linked to an active agent profile. "
			"Set Booking Agent on the reservation or log in as the agent."
		),
		title=_("Booking agent profile missing"),
	)


def validate_agent_can_confirm_booking(booking, user: str | None = None, *, via_credit: bool = False):
	agent = (
		resolve_credit_agent_for_confirmation(booking, user=user)
		if via_credit
		else get_booking_agent_for_user(user)
	)
	if not agent:
		frappe.throw(
			_("No active Booking Agent profile is linked to your user."),
			title=_("Booking agent profile missing"),
		)
	if not agent.allows_confirmation():
		frappe.throw(
			_("Your booking agent profile is not allowed to confirm tickets."),
			title=_("Confirmation not permitted"),
		)
	if via_credit:
		return validate_credit_confirmation_for_booking(booking, user=user)
	return agent


def create_booking_agent_profile(
	user: str,
	booking_company: str | None = None,
	agent_name: str | None = None,
	email: str | None = None,
	phone: str | None = None,
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
	status: str = "Active",
	user_type: str = "Agent",
	can_book_ticket: str = "Yes",
	can_confirm_ticket: str = "Yes",
	deposit_required: str = "No",
	confirmation_mode: str | None = None,
):
	"""Create or update the Booking Agent profile for a portal user."""
	booking_company = (booking_company or "").strip() or None
	if not booking_company and agent_name:
		from bilan_sky.bilan_air_booking_system.utils.booking_company import create_booking_company

		company_doc = create_booking_company(agent_name.strip(), is_agency=0)
		booking_company = company_doc.name

	if not booking_company:
		frappe.throw("Company / Agency is required.")

	if not frappe.db.exists("Booking Company", booking_company):
		frappe.throw("Selected company or agency was not found.")

	existing = frappe.db.get_value("Booking Agent", {"user": user}, "name")
	limit = flt(credit_limit) if credit_limit is not None else 0.0
	status = (status or "Active").strip()
	if status not in ("Active", "Inactive"):
		frappe.throw("Invalid status.")
	for field_name, value, options in (
		("can_book_ticket", can_book_ticket, ("Yes", "No")),
		("can_confirm_ticket", can_confirm_ticket, ("Yes", "No")),
		("deposit_required", deposit_required, ("Yes", "No")),
	):
		if (value or "").strip() not in options:
			frappe.throw(f"Invalid value for {field_name}.")

	payload = {
		"booking_company": booking_company,
		"username": (username or "").strip(),
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
		"status": status,
		"user_type": (user_type or "Agent").strip() or "Agent",
		"can_book_ticket": can_book_ticket,
		"can_confirm_ticket": can_confirm_ticket,
		"deposit_required": deposit_required,
		"credit_limit": limit,
		"linked_customer": linked_customer,
		"notes": notes,
	}
	if confirmation_mode:
		payload["confirmation_mode"] = confirmation_mode

	if existing:
		doc = frappe.get_doc("Booking Agent", existing)
		doc.update(payload)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": "Booking Agent", **payload})
		doc.insert(ignore_permissions=True)

	sync_booking_agent_user_enabled(doc)
	return doc


def validate_credit_confirmation_for_booking(booking, user: str | None = None):
	"""Ensure the current user may confirm this fare on agent credit."""
	booking.calculate_total_fare()
	amount = flt(booking.total_fare)
	if amount <= 0:
		frappe.throw(
			_("Cannot confirm on credit until a total fare is calculated. Assign seats, save the reservation, and ensure route fares are set."),
			title=_("Zero fare"),
		)
	agent = resolve_credit_agent_for_confirmation(booking, user=user)
	if not agent.allows_confirmation():
		frappe.throw(
			_("The selected booking agent is not allowed to confirm tickets."),
			title=_("Confirmation not permitted"),
		)
	if not agent.can_confirm_on_credit(amount):
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
