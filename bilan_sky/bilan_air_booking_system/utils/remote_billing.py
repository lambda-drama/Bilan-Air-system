# Copyright (c) 2026, NF and contributors

"""Sales Invoice and Payment Entry on the external ERPNext accounting site."""

from __future__ import annotations

import json

import frappe
from frappe import _
from frappe.utils import add_days, flt, nowdate

from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting_from_doc
from bilan_sky.bilan_air_booking_system.utils.remote_erp import (
	get_remote_client,
	is_remote_accounting_enabled,
	remote_accounting_config,
)


REMOTE_ITEM_GROUP = "Service"


def _item_code(item_link: str) -> str:
	if not item_link:
		return ""
	if frappe.db.exists("Item", item_link):
		return frappe.db.get_value("Item", item_link, "item_code") or item_link
	return item_link


def _local_item_details(item_link: str) -> dict:
	"""Details from local Item (if any) used when creating on the accounting site."""
	item_code = _item_code(item_link) or (item_link or "").strip()
	if not item_code:
		return {}

	if frappe.db.exists("Item", item_link):
		doc = frappe.get_doc("Item", item_link)
		return {
			"item_code": doc.item_code or doc.name,
			"item_name": doc.item_name or doc.item_code or doc.name,
			"description": doc.description or "",
			"stock_uom": doc.stock_uom or "Nos",
		}

	return {
		"item_code": item_code,
		"item_name": item_code,
		"description": "",
		"stock_uom": "Nos",
	}


def _ensure_remote_uom(client, uom: str = "Nos") -> str:
	if client.get_list("UOM", filters={"name": uom}, fields=["name"], limit=1):
		return uom
	client.insert_doc({"doctype": "UOM", "uom_name": uom, "enabled": 1})
	return uom


def _ensure_remote_item_group(client, group_name: str = REMOTE_ITEM_GROUP) -> str:
	for name in (group_name, "Services", "Service"):
		if client.get_list("Item Group", filters={"name": name}, fields=["name"], limit=1):
			return name

	parent = None
	for candidate in ("All Item Groups", "Products", "Services"):
		if client.get_list("Item Group", filters={"name": candidate}, fields=["name"], limit=1):
			parent = candidate
			break

	if not parent:
		roots = client.get_list(
			"Item Group",
			fields=["name"],
			filters={"is_group": 1},
			limit=1,
			order_by="name asc",
		)
		parent = roots[0]["name"] if roots else "All Item Groups"

	target = group_name
	if client.get_list("Item Group", filters={"name": target}, limit=1):
		return target

	client.insert_doc(
		{
			"doctype": "Item Group",
			"item_group_name": target,
			"parent_item_group": parent,
			"is_group": 0,
		}
	)
	return target


def _find_remote_item_code(client, item_code: str) -> str | None:
	"""Return the item_code to use on invoice lines if Item exists on remote site."""
	for filters in ({"item_code": item_code}, {"name": item_code}):
		rows = client.get_list(
			"Item",
			filters=filters,
			fields=["name", "item_code"],
			limit=1,
		)
		if rows:
			return rows[0].get("item_code") or rows[0].get("name") or item_code
	return None


def _remote_company_income_account(client, company: str) -> str | None:
	try:
		company_doc = client.get_doc("Company", company)
		return company_doc.get("default_income_account") or None
	except Exception:
		return None


def ensure_remote_item(
	client,
	item_link: str,
	*,
	company: str,
	item_group: str = REMOTE_ITEM_GROUP,
) -> str:
	"""Return item_code on accounting site, creating Item under item_group if missing."""
	details = _local_item_details(item_link)
	item_code = (details.get("item_code") or "").strip()
	if not item_code:
		frappe.throw(_("Item is not configured in BA Settings."))

	existing = _find_remote_item_code(client, item_code)
	if existing:
		return existing

	item_group_name = _ensure_remote_item_group(client, item_group)
	stock_uom = _ensure_remote_uom(client, details.get("stock_uom") or "Nos")

	item_doc: dict = {
		"doctype": "Item",
		"item_code": item_code,
		"item_name": details.get("item_name") or item_code,
		"item_group": item_group_name,
		"stock_uom": stock_uom,
		"is_stock_item": 0,
		"is_sales_item": 1,
		"is_purchase_item": 0,
	}
	if details.get("description"):
		item_doc["description"] = details["description"]

	income_account = get_ba_setting_from_doc(client.settings, "default_expense_account")
	if not income_account:
		income_account = _remote_company_income_account(client, company)
	if income_account:
		item_doc["item_defaults"] = [
			{
				"company": company,
				"income_account": income_account,
			}
		]

	try:
		created = client.insert_doc(item_doc)
	except frappe.ValidationError as exc:
		# Item may already exist (race) or was created with matching item_code
		existing = _find_remote_item_code(client, item_code)
		if existing:
			return existing
		raise exc

	remote_code = created.get("item_code") or created.get("name") or item_code
	verified = _find_remote_item_code(client, remote_code)
	if not verified:
		frappe.throw(
			_("Item {0} could not be created on the accounting site. Check API user permissions for Item.").format(
				item_code
			)
		)
	return verified


def get_remote_company() -> str:
	config = remote_accounting_config()
	return config["company"] if config else ""


def list_remote_modes_of_payment() -> list[dict]:
	"""Mode of Payment rows for the configured remote company."""
	client = get_remote_client()
	company = client.company
	modes = client.get_list(
		"Mode of Payment",
		fields=["name", "type", "enabled"],
		filters={"enabled": 1},
		limit=200,
		order_by="name asc",
	)
	result = []
	for row in modes:
		accounts = client.get_list(
			"Mode of Payment Account",
			fields=["company", "default_account"],
			filters={"parent": row["name"], "parenttype": "Mode of Payment"},
			limit=20,
		)
		company_account = next((a for a in accounts if a.get("company") == company), None)
		if company_account and company_account.get("default_account"):
			result.append(
				{
					"name": row["name"],
					"type": row.get("type"),
					"default_account": company_account["default_account"],
				}
			)
	return result


def list_remote_bank_cash_accounts() -> list[dict]:
	"""Bank/Cash accounts for the remote company (for BA Settings defaults)."""
	client = get_remote_client()
	return client.get_list(
		"Account",
		fields=["name", "account_name", "account_type"],
		filters={
			"company": client.company,
			"is_group": 0,
			"account_type": ["in", ["Bank", "Cash"]],
			"disabled": 0,
		},
		limit=200,
		order_by="name asc",
	)


def resolve_remote_paid_to_account(settings, mode_of_payment=None) -> str:
	from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting_from_doc

	client = get_remote_client()
	company = client.company

	if mode_of_payment:
		rows = client.get_list(
			"Mode of Payment Account",
			fields=["default_account"],
			filters={
				"parent": mode_of_payment,
				"parenttype": "Mode of Payment",
				"company": company,
			},
			limit=1,
		)
		if rows and rows[0].get("default_account"):
			return rows[0]["default_account"]

		label = (mode_of_payment or "").lower()
		if "mpesa" in label or "m-pesa" in label:
			mpesa = get_ba_setting_from_doc(settings, "default_mpesa_account")
			if mpesa:
				return mpesa

	if get_ba_setting_from_doc(settings, "default_cash_account"):
		return get_ba_setting_from_doc(settings, "default_cash_account")
	if get_ba_setting_from_doc(settings, "default_mpesa_account"):
		return get_ba_setting_from_doc(settings, "default_mpesa_account")

	frappe.throw(
		_("Set Default Cash Account or Mode of Payment accounts in BA Settings for company {0}.").format(
			company
		)
	)


def _remote_default_customer_group(client) -> str:
	for name in ("Individual", "Commercial", "All Customer Groups"):
		if client.get_list("Customer Group", filters={"name": name}, limit=1):
			return name
	groups = client.get_list("Customer Group", fields=["name"], filters={"is_group": 0}, limit=1)
	if groups:
		return groups[0]["name"]
	frappe.throw(_("No Customer Group found on the accounting site."))


def _get_remote_company_abbreviation(client, company: str) -> str:
	company_doc = client.get_doc("Company", company)
	abbr = (company_doc.get("abbr") or "").strip().upper()
	if abbr:
		return abbr
	# Fallback: first letters of each word in company name
	name = (company_doc.get("company_name") or company or "").strip()
	if name:
		parts = [p[0] for p in name.split() if p]
		if parts:
			return "".join(parts).upper()[:10]
	frappe.throw(
		_("Company {0} on the accounting site has no abbreviation. Set Abbr on the Company record.").format(
			company
		)
	)


def _parse_remote_invoice_sequence(value: str, prefix: str) -> int | None:
	if not value or not value.startswith(prefix):
		return None
	suffix = (value[len(prefix) :] or "").strip()
	try:
		return int(suffix)
	except ValueError:
		return None


def _remote_invoice_number_in_use(client, invoice_no: str) -> bool:
	if client.doc_exists("Sales Invoice", invoice_no):
		return True
	return bool(
		client.get_list(
			"Sales Invoice",
			fields=["name"],
			filters={"custom_invoice_no": invoice_no},
			limit=1,
		)
	)


def _get_next_remote_invoice_sequence(client, company_abbr: str, year: str) -> int:
	"""Next sequence from the highest existing BA-YYYY-##### (name or custom_invoice_no)."""
	prefix = f"{company_abbr}-{year}-"
	pattern = f"{prefix}%"
	max_seq = 0
	for field in ("custom_invoice_no", "name"):
		rows = client.get_list(
			"Sales Invoice",
			fields=[field],
			filters=[[field, "like", pattern]],
			limit=500,
			order_by=f"{field} desc",
		)
		for row in rows:
			seq = _parse_remote_invoice_sequence((row.get(field) or "").strip(), prefix)
			if seq is not None:
				max_seq = max(max_seq, seq)
	return max_seq + 1


def generate_remote_invoice_number(client, company: str) -> str:
	abbr = _get_remote_company_abbreviation(client, company)
	year = str(nowdate())[:4]
	seq = _get_next_remote_invoice_sequence(client, abbr, year)
	prefix = f"{abbr}-{year}-"
	for _ in range(50):
		invoice_no = f"{prefix}{seq:05d}"
		if not _remote_invoice_number_in_use(client, invoice_no):
			return invoice_no
		seq += 1
	frappe.throw(_("Could not allocate a unique invoice number on the accounting site."))


def get_or_create_remote_customer(booking) -> str:
	client = get_remote_client()
	payer_name = (booking.payer_name or "").strip()
	if not payer_name:
		frappe.throw(_("Payer Full Name is required to create a customer on the accounting site."))

	existing = client.get_list(
		"Customer",
		fields=["name"],
		filters={"customer_name": payer_name},
		limit=1,
	)
	if existing:
		return existing[0]["name"]

	customer_group = _remote_default_customer_group(client)
	customer = {
		"doctype": "Customer",
		"customer_name": payer_name,
		"customer_type": "Individual",
		"customer_group": customer_group,
		"territory": "All Territories",
	}
	if booking.payer_email:
		customer["email_id"] = booking.payer_email
	if booking.payer_phone:
		customer["mobile_no"] = booking.payer_phone

	return client.insert(customer)


def create_remote_sales_invoice(booking, *, submit: bool = False) -> str:
	client = get_remote_client()
	settings = client.settings
	company = client.company

	customer = booking.customer_link or get_or_create_remote_customer(booking)
	if not settings.fare_item:
		frappe.throw(_("Set Fare Item in BA Settings before creating invoice."))
	if not settings.baggage_fee:
		frappe.throw(_("Set Baggage Fee item in BA Settings before creating invoice."))

	fare_item = ensure_remote_item(client, settings.fare_item, company=company)
	baggage_item = ensure_remote_item(client, settings.baggage_fee, company=company)

	invoice_no = generate_remote_invoice_number(client, company)
	posting_date = nowdate()
	due_date = add_days(posting_date, 7)

	price_list = get_ba_setting_from_doc(settings, "default_price_list")
	income_account = get_ba_setting_from_doc(settings, "default_expense_account")

	invoice = {
		"doctype": "Sales Invoice",
		"customer": customer,
		"company": company,
		"posting_date": str(posting_date),
		"due_date": str(due_date),
		"currency": settings.default_currency or None,
		"custom_invoice_no": invoice_no,
		"remarks": f"Air Booking {booking.name}",
		"items": [],
	}
	if price_list:
		invoice["selling_price_list"] = price_list

	def _remote_item_row(item_code: str, rate: float, description: str) -> dict:
		row = {
			"item_code": item_code,
			"qty": 1,
			"rate": rate,
			"description": description,
		}
		if income_account:
			row["income_account"] = income_account
		return row

	fare_amount = flt(booking.total_fare)
	if fare_amount > 0:
		invoice["items"].append(
			_remote_item_row(
				fare_item,
				fare_amount,
				f"Main Fare for booking {booking.name}",
			)
		)

	baggage_amount = flt(booking._get_baggage_total_fee())
	if baggage_amount > 0:
		invoice["items"].append(
			_remote_item_row(
				baggage_item,
				baggage_amount,
				f"Excess baggage charges for booking {booking.name}",
			)
		)

	if not invoice["items"]:
		frappe.throw(_("No billable amount found (fare/baggage)."))

	created = client.insert_doc(invoice)
	invoice_name = created.get("name")
	if not invoice_name:
		frappe.throw(_("Sales Invoice was not created on the accounting site."))

	if submit:
		client.submit("Sales Invoice", invoice_name)

	if not booking.customer_link:
		booking.customer_link = customer

	return invoice_name


def remote_invoice_number(client, invoice_name: str) -> str:
	inv = client.get_doc("Sales Invoice", invoice_name)
	return (inv.get("custom_invoice_no") or invoice_name or "").strip() or invoice_name


def _prepare_remote_return_doc_for_insert(client, return_doc: dict) -> dict:
	"""Return docs from make_sales_return copy the source custom_invoice_no — replace it."""
	for key in (
		"name",
		"owner",
		"creation",
		"modified",
		"modified_by",
		"docstatus",
		"__unsaved",
		"__onload",
	):
		return_doc.pop(key, None)

	company = return_doc.get("company") or client.company
	return_doc["custom_invoice_no"] = generate_remote_invoice_number(client, company)

	for row in return_doc.get("items") or []:
		if isinstance(row, dict):
			row.pop("name", None)

	return return_doc


def create_remote_return_sales_invoice(
	original_invoice_name: str,
	refund_amount: float | None = None,
	*,
	submit: bool = True,
) -> tuple[str, str]:
	"""Return invoice on the accounting site (full or partial credit note)."""
	from bilan_sky.bilan_air_booking_system.utils.billing import _apply_partial_return_amount

	client = get_remote_client()
	return_doc = client.run_method(
		"erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return",
		source_name=original_invoice_name,
	)
	if isinstance(return_doc, str):
		return_doc = json.loads(return_doc)
	if not isinstance(return_doc, dict):
		frappe.throw(_("Could not build return invoice for {0}.").format(original_invoice_name))

	if refund_amount is not None:
		_apply_partial_return_amount(return_doc, flt(refund_amount))

	return_doc = _prepare_remote_return_doc_for_insert(client, return_doc)

	created = client.insert_doc(return_doc)
	return_name = created.get("name")
	if not return_name:
		frappe.throw(_("Return invoice was not created on the accounting site."))

	if submit:
		client.submit("Sales Invoice", return_name)

	return return_name, remote_invoice_number(client, return_name)


def submit_remote_sales_invoice(invoice_name: str) -> None:
	client = get_remote_client()
	doc = client.get_doc("Sales Invoice", invoice_name)
	if doc.get("docstatus") == 0:
		client.submit("Sales Invoice", invoice_name)


def create_remote_refund_payment_entry(
	return_invoice_name: str,
	*,
	mode_of_payment: str | None = None,
	paid_account: str | None = None,
	reference_no: str | None = None,
) -> str:
	"""Pay the customer on the accounting site against a return Sales Invoice."""
	from bilan_sky.bilan_air_booking_system.utils.billing import (
		_apply_refund_amount_to_payment_doc,
		_existing_submitted_payment_for_invoice,
		_refund_amount_due_on_invoice,
	)

	client = get_remote_client()
	settings = client.settings

	invoice = client.get_doc("Sales Invoice", return_invoice_name)
	if invoice.get("docstatus") == 0:
		client.submit("Sales Invoice", return_invoice_name)
		invoice = client.get_doc("Sales Invoice", return_invoice_name)

	existing = _existing_submitted_payment_for_invoice(return_invoice_name, payment_type="Pay")
	if existing:
		return existing

	refund_due = _refund_amount_due_on_invoice(invoice)
	if refund_due <= 0:
		frappe.throw(_("Return invoice {0} has no refundable amount on the accounting site.").format(return_invoice_name))

	if not paid_account:
		paid_account = resolve_remote_paid_to_account(settings, mode_of_payment)

	# Do not pass party_amount — form POST sends strings and ERPNext abs() fails on them.
	pe_doc = client.run_method(
		"erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
		dt="Sales Invoice",
		dn=return_invoice_name,
		bank_account=paid_account,
		payment_type="Pay",
	)
	if isinstance(pe_doc, str):
		pe_doc = json.loads(pe_doc)

	for key in ("name", "owner", "creation", "modified", "modified_by", "docstatus"):
		pe_doc.pop(key, None)

	if flt(pe_doc.get("paid_amount")) <= 0:
		pe_doc = _apply_refund_amount_to_payment_doc(pe_doc, refund_due)

	if mode_of_payment:
		pe_doc["mode_of_payment"] = mode_of_payment
	if reference_no:
		pe_doc["reference_no"] = reference_no
	pe_doc["remarks"] = _("Refund for {0}").format(reference_no or return_invoice_name)

	pe_name = client.insert(pe_doc)
	client.submit("Payment Entry", pe_name)
	return pe_name


def create_remote_payment_entry(
	invoice_name: str,
	*,
	mode_of_payment: str | None = None,
	paid_account: str | None = None,
	reference_no: str | None = None,
) -> str:
	client = get_remote_client()
	settings = client.settings

	invoice = client.get_doc("Sales Invoice", invoice_name)
	if invoice.get("docstatus") == 0:
		client.submit("Sales Invoice", invoice_name)
		invoice = client.get_doc("Sales Invoice", invoice_name)

	outstanding = flt(invoice.get("outstanding_amount"))
	if outstanding <= 0:
		refs = client.get_list(
			"Payment Entry Reference",
			fields=["parent"],
			filters={
				"reference_doctype": "Sales Invoice",
				"reference_name": invoice_name,
			},
			limit=5,
		)
		for ref in refs:
			pe_name = ref.get("parent")
			if pe_name:
				pe = client.get_doc("Payment Entry", pe_name)
				if pe.get("docstatus") == 1:
					return pe_name
		frappe.throw(_("Sales Invoice {0} is already fully paid on the accounting site.").format(invoice_name))

	if not paid_account:
		paid_account = resolve_remote_paid_to_account(settings, mode_of_payment)
	pe_doc = client.run_method(
		"erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
		dt="Sales Invoice",
		dn=invoice_name,
		bank_account=paid_account,
	)
	if isinstance(pe_doc, str):
		pe_doc = json.loads(pe_doc)

	if mode_of_payment:
		pe_doc["mode_of_payment"] = mode_of_payment
	if reference_no:
		pe_doc["reference_no"] = reference_no
	pe_doc["remarks"] = _("Payment for {0}").format(reference_no or invoice_name)

	pe_name = client.insert(pe_doc)
	client.submit("Payment Entry", pe_name)
	return pe_name


def fetch_remote_sales_invoice(invoice_name: str) -> dict | None:
	if not invoice_name or not is_remote_accounting_enabled():
		return None
	client = get_remote_client()
	try:
		inv = client.get_doc("Sales Invoice", invoice_name)
	except Exception:
		return None
	return {
		"name": inv.get("name"),
		"invoice_number": inv.get("custom_invoice_no") or inv.get("name"),
		"customer": inv.get("customer"),
		"posting_date": inv.get("posting_date"),
		"due_date": inv.get("due_date"),
		"grand_total": inv.get("grand_total"),
		"outstanding_amount": inv.get("outstanding_amount"),
		"status": inv.get("status"),
		"currency": inv.get("currency"),
		"docstatus": inv.get("docstatus"),
		"remarks": inv.get("remarks"),
		"company": inv.get("company"),
	}
