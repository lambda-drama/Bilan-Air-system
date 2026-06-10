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


def get_sales_invoice_grand_total(invoice_name: str) -> float:
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import fetch_remote_sales_invoice

		remote = fetch_remote_sales_invoice(invoice_name)
		return flt(remote.get("grand_total")) if remote else 0

	if frappe.db.exists("Sales Invoice", invoice_name):
		return flt(frappe.db.get_value("Sales Invoice", invoice_name, "grand_total"))
	return 0


def _return_line_amount(row) -> float:
	"""Absolute line total on a return invoice (qty is often negative on credit notes)."""
	if isinstance(row, dict):
		amount = flt(row.get("amount"))
		if amount:
			return abs(amount)
		return abs(flt(row.get("rate")) * flt(row.get("qty") or 1))
	amount = flt(getattr(row, "amount", None))
	if amount:
		return abs(amount)
	return abs(flt(row.rate) * flt(row.qty or 1))


def _apply_partial_return_amount(return_doc, refund_amount: float) -> None:
	items = return_doc.get("items") if isinstance(return_doc, dict) else return_doc.items
	rows = list(items or [])
	if not rows:
		frappe.throw(_("Cannot calculate partial refund on invoice with no line items."))
	total = sum(_return_line_amount(row) for row in rows)
	if total <= 0:
		frappe.throw(_("Cannot calculate partial refund on invoice with no line items."))
	if flt(refund_amount) >= total:
		return
	ratio = flt(refund_amount) / total
	for row in rows:
		if isinstance(row, dict):
			row["rate"] = flt(row.get("rate")) * ratio
			if row.get("amount") is not None:
				row["amount"] = flt(row.get("amount")) * ratio
		else:
			row.rate = flt(row.rate) * ratio
			if getattr(row, "amount", None) is not None:
				row.amount = flt(row.amount) * ratio


def _refund_amount_due_on_invoice(invoice) -> float:
	"""Outstanding credit on a return Sales Invoice (amount to pay the customer)."""
	if isinstance(invoice, dict):
		outstanding = flt(invoice.get("outstanding_amount"))
		grand_total = flt(invoice.get("grand_total"))
	else:
		outstanding = flt(getattr(invoice, "outstanding_amount", None))
		grand_total = flt(getattr(invoice, "grand_total", None))
	if outstanding:
		return abs(outstanding)
	return abs(grand_total)


def _apply_refund_amount_to_payment_doc(pe_doc: dict, refund_amount: float) -> dict:
	"""Ensure payment entry amounts are numeric (remote API may return strings)."""
	amount = abs(flt(refund_amount))
	if amount <= 0:
		return pe_doc
	pe_doc["paid_amount"] = amount
	pe_doc["received_amount"] = amount
	for ref in pe_doc.get("references") or []:
		if not isinstance(ref, dict):
			continue
		ref["allocated_amount"] = amount
		if not flt(ref.get("outstanding_amount")):
			ref["outstanding_amount"] = amount
	return pe_doc


def _existing_submitted_payment_for_invoice(invoice_name: str, *, payment_type: str) -> str | None:
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_erp import get_remote_client

		client = get_remote_client()
		refs = client.get_list(
			"Payment Entry Reference",
			fields=["parent"],
			filters={
				"reference_doctype": "Sales Invoice",
				"reference_name": invoice_name,
			},
			limit=10,
		)
		for ref in refs:
			pe_name = ref.get("parent")
			if not pe_name:
				continue
			pe = client.get_doc("Payment Entry", pe_name)
			if pe.get("docstatus") == 1 and pe.get("payment_type") == payment_type:
				return pe_name
		return None

	existing = frappe.db.sql(
		"""
		select pe.name
		from `tabPayment Entry Reference` per
		inner join `tabPayment Entry` pe on pe.name = per.parent
		where per.reference_doctype = 'Sales Invoice'
			and per.reference_name = %s
			and pe.docstatus = 1
			and pe.payment_type = %s
		limit 1
		""",
		(invoice_name, payment_type),
	)
	return existing[0][0] if existing else None


def create_refund_payment_entry(
	return_invoice_name: str,
	*,
	mode_of_payment: str | None = None,
	paid_account: str | None = None,
	reference_no: str | None = None,
) -> str:
	"""Pay the customer against a submitted return Sales Invoice."""
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
			create_remote_refund_payment_entry,
		)

		return create_remote_refund_payment_entry(
			return_invoice_name,
			mode_of_payment=mode_of_payment,
			paid_account=paid_account,
			reference_no=reference_no,
		)

	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	invoice = frappe.get_doc("Sales Invoice", return_invoice_name)
	if invoice.docstatus == 0:
		invoice.submit()

	existing = _existing_submitted_payment_for_invoice(return_invoice_name, payment_type="Pay")
	if existing:
		return existing

	refund_due = _refund_amount_due_on_invoice(invoice)
	if refund_due <= 0:
		frappe.throw(_("Return invoice {0} has no refundable amount.").format(return_invoice_name))

	settings = frappe.get_single("BA Settings")
	if not paid_account:
		paid_account = resolve_paid_to_account(settings, mode_of_payment, invoice.company)

	pe = get_payment_entry(
		"Sales Invoice",
		return_invoice_name,
		party_amount=refund_due,
		bank_account=paid_account,
		payment_type="Pay",
	)
	if mode_of_payment:
		pe.mode_of_payment = mode_of_payment
	if reference_no:
		pe.reference_no = reference_no
	pe.remarks = _("Refund for {0}").format(reference_no or return_invoice_name)

	pe.insert(ignore_permissions=True)
	pe.submit()
	return pe.name


def create_return_sales_invoice(
	original_invoice_name: str,
	refund_amount: float | None = None,
	*,
	submit: bool = True,
) -> tuple[str, str]:
	"""Create a return (credit) sales invoice against an original invoice."""
	if is_remote_accounting_enabled():
		from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
			create_remote_return_sales_invoice,
		)

		return create_remote_return_sales_invoice(
			original_invoice_name,
			refund_amount=refund_amount,
			submit=submit,
		)

	from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_sales_return

	return_doc = make_sales_return(original_invoice_name)
	if refund_amount is not None:
		_apply_partial_return_amount(return_doc, flt(refund_amount))
	return_doc.insert(ignore_permissions=True)
	if submit:
		return_doc.submit()
	return return_doc.name, return_doc.name
