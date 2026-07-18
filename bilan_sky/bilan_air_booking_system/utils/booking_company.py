"""Booking Company helpers for portal and agent profiles."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint


def serialize_booking_company(doc) -> dict:
	from bilan_sky.bilan_air_booking_system.utils.company_print_branding import (
		serialize_company_branding,
	)

	return serialize_company_branding(doc)


def company_agency_label(name: str | None) -> str | None:
	"""Display name for a linked booking company (plain name only)."""
	return company_agency_name(name)


def company_agency_name(name: str | None) -> str | None:
	"""Plain company or agency name."""
	if not name:
		return None
	return frappe.db.get_value("Booking Company", name, "company_agency") or name


def enrich_agent_company_fields(row: dict) -> dict:
	"""Add company_agency / is_agency from booking_company link."""
	company = row.get("booking_company")
	if not company:
		return row
	meta = frappe.db.get_value(
		"Booking Company",
		company,
		["company_agency", "is_agency"],
		as_dict=True,
	)
	if meta:
		row["company_agency"] = meta.company_agency
		row["is_agency"] = cint(meta.is_agency)
		row["company_display"] = meta.company_agency
	return row


def create_booking_company(company_agency: str, *, is_agency: int = 0) -> frappe.Document:
	company_agency = (company_agency or "").strip()
	if not company_agency:
		frappe.throw(_("Company or agency name is required."))

	if frappe.db.exists("Booking Company", company_agency):
		doc = frappe.get_doc("Booking Company", company_agency)
		if cint(is_agency) and not doc.is_agency:
			doc.is_agency = 1
			doc.save(ignore_permissions=True)
		return doc

	doc = frappe.get_doc(
		{
			"doctype": "Booking Company",
			"company_agency": company_agency,
			"is_agency": cint(is_agency),
		}
	)
	doc.insert(ignore_permissions=True)
	return doc
