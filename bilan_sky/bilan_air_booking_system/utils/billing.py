import frappe
from frappe import _
from frappe.utils import flt

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting_from_doc
from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled


def list_enabled_modes_of_payment() -> list[dict]:
	"""Enabled Mode of Payment rows from this site (not the remote accounting API)."""
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	modes = []
	for row in frappe.get_all(
		"Mode of Payment",
		filters={"enabled": 1},
		fields=["name"],
		order_by="name asc",
	):
		default_account = None
		if company:
			default_account = frappe.db.get_value(
				"Mode of Payment Account",
				{"parent": row.name, "company": company},
				"default_account",
			)
		modes.append({"name": row.name, "default_account": default_account})
	return modes


def apply_sales_invoice_defaults_from_settings(invoice, settings=None):
	"""Apply default price list and income account from BA Settings."""
	settings = settings or frappe.get_single("BA Settings")
	price_list = get_ba_setting_from_doc(settings, "default_price_list")
	if price_list:
		invoice.selling_price_list = price_list

	income_account = get_ba_setting_from_doc(settings, "default_expense_account")
	return income_account


def sales_invoice_item_row(
	item_code: str,
	rate: float,
	description: str,
	settings=None,
) -> dict:
	"""Build a Sales Invoice item row using BA Settings income account when set."""
	row = {
		"item_code": item_code,
		"qty": 1,
		"rate": flt(rate),
		"description": description,
	}
	settings = settings or frappe.get_single("BA Settings")
	income_account = get_ba_setting_from_doc(settings, "default_expense_account")
	if income_account:
		row["income_account"] = income_account
	return row


def resolve_paid_to_account(settings, mode_of_payment=None, company=None):
	"""Bank/cash account used as paid_to on a Receive Payment Entry."""
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
			resolve_remote_paid_to_account,
		)

		return resolve_remote_paid_to_account(settings, mode_of_payment)

	if not company:
		company = frappe.db.get_single_value("Global Defaults", "default_company")

	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting_from_doc

	if mode_of_payment and frappe.db.exists("Mode of Payment", mode_of_payment):
		account = frappe.db.get_value(
			"Mode of Payment Account",
			{"parent": mode_of_payment, "company": company},
			"default_account",
		)
		if account:
			return account

		label = (mode_of_payment or "").lower()
		if "mpesa" in label or "m-pesa" in label:
			mpesa = get_ba_setting_from_doc(settings, "default_mpesa_account")
			if mpesa:
				return mpesa

	cash = get_ba_setting_from_doc(settings, "default_cash_account")
	if cash:
		return cash
	mpesa = get_ba_setting_from_doc(settings, "default_mpesa_account")
	if mpesa:
		return mpesa

	from erpnext.accounts.doctype.journal_entry.journal_entry import get_default_bank_cash_account

	account = get_default_bank_cash_account(company, "Cash")
	if not account:
		frappe.throw(_("Set Default Cash Account or Mode of Payment accounts in BA Settings."))
	return account


def create_and_submit_payment_entry(invoice_name, mode_of_payment=None, paid_account=None, reference_no=None):
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
			create_remote_payment_entry,
		)

		return create_remote_payment_entry(
			invoice_name,
			mode_of_payment=mode_of_payment,
			paid_account=paid_account,
			reference_no=reference_no,
		)

	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	invoice = frappe.get_doc("Sales Invoice", invoice_name)
	if invoice.docstatus == 0:
		invoice.submit()

	outstanding = flt(invoice.outstanding_amount)
	if outstanding <= 0:
		existing = frappe.db.sql(
			"""
			select per.parent
			from `tabPayment Entry Reference` per
			inner join `tabPayment Entry` pe on pe.name = per.parent
			where per.reference_doctype = 'Sales Invoice'
				and per.reference_name = %s
				and pe.docstatus = 1
			limit 1
			""",
			invoice_name,
		)
		if existing:
			return existing[0][0]
		frappe.throw(_("Sales Invoice {0} is already fully paid.").format(invoice_name))

	settings = frappe.get_single("BA Settings")
	if not paid_account:
		paid_account = resolve_paid_to_account(settings, mode_of_payment, invoice.company)

	pe = get_payment_entry("Sales Invoice", invoice_name, bank_account=paid_account)
	if mode_of_payment:
		pe.mode_of_payment = mode_of_payment
	if reference_no:
		pe.reference_no = reference_no
	pe.remarks = _("Payment for {0}").format(reference_no or invoice_name)

	pe.insert(ignore_permissions=True)
	pe.submit()

	return pe.name
