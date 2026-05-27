import frappe
from frappe import _
from frappe.utils import flt


def resolve_paid_to_account(settings, mode_of_payment=None, company=None):
	"""Bank/cash account used as paid_to on a Receive Payment Entry."""
	if not company:
		company = frappe.db.get_single_value("Global Defaults", "default_company")

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
			if settings.default_mpesa_account:
				return settings.default_mpesa_account

	if settings.default_cash_account:
		return settings.default_cash_account
	if settings.default_mpesa_account:
		return settings.default_mpesa_account

	from erpnext.accounts.doctype.journal_entry.journal_entry import get_default_bank_cash_account

	account = get_default_bank_cash_account(company, "Cash")
	if not account:
		frappe.throw(_("Set Default Cash Account or Mode of Payment accounts in BA Settings."))
	return account


def create_and_submit_payment_entry(invoice_name, mode_of_payment=None, paid_account=None, reference_no=None):
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
