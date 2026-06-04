"""Booking Company helpers for portal and agent profiles."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint


def serialize_booking_company(doc) -> dict:
	return {
		"name": doc.name,
		"company_agency": doc.company_agency,
		"is_agency": cint(getattr(doc, "is_agency", 0)),
	}


def company_agency_label(name: str | None) -> str | None:
	if not name:
		return None
	label = frappe.db.get_value("Booking Company", name, "company_agency")
	if not label:
		return name
	is_agency = cint(frappe.db.get_value("Booking Company", name, "is_agency"))
	return f"{label} (Agency)" if is_agency else label


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
		row["company_display"] = (
			f"{meta.company_agency} (Agency)" if meta.is_agency else meta.company_agency
		)
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
