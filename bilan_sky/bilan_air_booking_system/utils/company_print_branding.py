"""Resolve agency logo for print documents from Booking Company settings."""

from __future__ import annotations

import frappe
from frappe.utils import cint

PRINT_LOGO_FLAGS = {
	"ticket": "show_logo_on_ticket",
	"baggage": "show_logo_on_baggage",
	"boarding_pass": "show_logo_on_boarding_pass",
}


def company_print_branding_for_booking(booking, document: str) -> dict | None:
	"""Return agency logo + company name when enabled for this print document."""
	flag = PRINT_LOGO_FLAGS.get(document)
	if not flag:
		return None

	agent = getattr(booking, "booking_agent", None)
	if not agent:
		return None

	company = frappe.db.get_value("Booking Agent", agent, "booking_company")
	if not company:
		return None

	row = frappe.db.get_value(
		"Booking Company",
		company,
		["logo", "company_agency", flag],
		as_dict=True,
	)
	if not row or not row.logo or not cint(row.get(flag)):
		return None
	return {
		"logo_url": row.logo,
		"company_agency": row.company_agency or company,
	}


def company_print_logo_for_booking(booking, document: str) -> str | None:
	"""Return agency logo URL when enabled for this print document, else None."""
	branding = company_print_branding_for_booking(booking, document)
	return branding["logo_url"] if branding else None


def serialize_company_branding(doc) -> dict:
	return {
		"name": doc.name,
		"company_agency": doc.company_agency,
		"is_agency": cint(getattr(doc, "is_agency", 0)),
		"logo": getattr(doc, "logo", None) or "",
		"show_logo_on_ticket": cint(getattr(doc, "show_logo_on_ticket", 0)),
		"show_logo_on_baggage": cint(getattr(doc, "show_logo_on_baggage", 0)),
		"show_logo_on_boarding_pass": cint(getattr(doc, "show_logo_on_boarding_pass", 0)),
	}
