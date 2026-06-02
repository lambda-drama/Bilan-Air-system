# Copyright (c) 2026, NF and contributors

import frappe
from frappe import _

from bilan_sky.bilan_air_booking_system.utils.remote_erp import (
	is_remote_accounting_enabled,
	remote_accounting_config,
)
from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
	list_remote_bank_cash_accounts,
	list_remote_modes_of_payment,
)


@frappe.whitelist()
def is_remote_accounting_active():
	return is_remote_accounting_enabled()


@frappe.whitelist()
def get_remote_accounting_options():
	"""Modes of payment and bank/cash accounts for the configured remote company."""
	if not is_remote_accounting_enabled():
		return {
			"enabled": False,
			"modes_of_payment": [],
			"accounts": [],
			"company": "",
		}

	config = remote_accounting_config()
	return {
		"enabled": True,
		"company": config["company"],
		"site_url": config["site_url"],
		"modes_of_payment": list_remote_modes_of_payment(),
		"accounts": list_remote_bank_cash_accounts(),
	}


@frappe.whitelist()
def test_remote_accounting_connection():
	"""Ping accounting site and verify company exists."""
	if not is_remote_accounting_enabled():
		frappe.throw(_("Configure Site URL, API Key, Secret Key, and Company in BA Settings."))

	from bilan_sky.bilan_air_booking_system.utils.remote_erp import get_remote_client

	client = get_remote_client()
	companies = client.get_list("Company", fields=["name"], filters={"name": client.company}, limit=1)
	if not companies:
		frappe.throw(_("Company {0} was not found on the accounting site.").format(client.company))

	return {
		"success": True,
		"company": client.company,
		"site_url": client.base_url,
		"message": _("Connected successfully."),
	}


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def remote_mode_of_payment_query(doctype, txt, searchfield, start, page_len, filters):
	if not is_remote_accounting_enabled():
		return []
	modes = list_remote_modes_of_payment()
	txt = (txt or "").lower()
	rows = []
	for mode in modes:
		name = mode["name"]
		if txt and txt not in name.lower():
			continue
		rows.append([name])
	return rows[start : start + page_len]


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def remote_bank_cash_account_query(doctype, txt, searchfield, start, page_len, filters):
	if not is_remote_accounting_enabled():
		return []
	accounts = list_remote_bank_cash_accounts()
	txt = (txt or "").lower()
	rows = []
	for account in accounts:
		name = account["name"]
		if txt and txt not in name.lower():
			continue
		rows.append([name])
	return rows[start : start + page_len]
