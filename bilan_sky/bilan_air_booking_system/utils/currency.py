# Copyright (c) 2026, NF and contributors

import frappe


def resolve_display_currency(doc_currency=None):
	"""Currency for UI: document field → company default → BA Settings → global."""
	if doc_currency:
		return doc_currency

	company = frappe.defaults.get_global_default("company")
	if company:
		currency = frappe.db.get_value("Company", company, "default_currency")
		if currency:
			return currency

	try:
		settings = frappe.get_single("BA Settings")
		if settings.default_currency:
			return settings.default_currency
	except Exception:
		pass

	return frappe.db.get_single_value("Global Defaults", "default_currency") or "USD"


def get_currency_display(doc_currency=None):
	currency = resolve_display_currency(doc_currency)
	symbol = frappe.db.get_value("Currency", currency, "symbol") if currency else None
	return {
		"currency": currency,
		"symbol": (symbol or currency or "").strip(),
	}
