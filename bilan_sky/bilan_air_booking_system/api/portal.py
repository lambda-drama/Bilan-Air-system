# Portal list / save helpers for the Bilan admin UI

import frappe
from frappe import _


def _paginated(doctype, fields, filters=None, or_filters=None, order_by="modified desc", limit=50, offset=0):
	filters = filters or {}
	total = frappe.db.count(doctype, filters=filters)
	data = frappe.get_all(
		doctype,
		filters=filters,
		or_filters=or_filters,
		fields=fields,
		order_by=order_by,
		limit_page_length=int(limit),
		limit_start=int(offset),
	)
	return {"data": data, "total": total}


@frappe.whitelist()
def list_flight_schedules(limit=50, offset=0, status=None, search=None):
	filters = {}
	if status:
		filters["status"] = status

	or_filters = None
	if search:
		or_filters = {
			"flight_number": ["like", f"%{search}%"],
			"name": ["like", f"%{search}%"],
		}

	return _paginated(
		"Flight Schedule",
		[
			"name",
			"flight_number",
			"route",
			"airplane",
			"departure_date",
			"departure_time",
			"arrival_date",
			"arrival_time",
			"status",
		],
		filters=filters,
		or_filters=or_filters,
		limit=limit,
		offset=offset,
	)


@frappe.whitelist()
def save_flight_schedule(data):
	"""Create or update a flight schedule."""
	if isinstance(data, str):
		import json

		data = json.loads(data)

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Flight Schedule", name)
		doc.update(data)
	else:
		doc = frappe.get_doc({"doctype": "Flight Schedule", **data})

	doc.save()
	if not frappe.db.exists("Seat Inventory", {"flight_schedule": doc.name}):
		doc.generate_seat_inventory()
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_air_bookings(limit=50, offset=0, status=None, search=None):
	filters = {}
	if status:
		filters["booking_status"] = status

	or_filters = None
	if search:
		or_filters = {
			"name": ["like", f"%{search}%"],
			"payer_name": ["like", f"%{search}%"],
			"payer_phone": ["like", f"%{search}%"],
		}

	return _paginated(
		"Air Booking",
		[
			"name",
			"flight_schedule",
			"payer_name",
			"payer_email",
			"payer_phone",
			"booking_status",
			"payment_status",
			"total_fare",
			"booking_date",
		],
		filters=filters,
		or_filters=or_filters,
		order_by="booking_date desc",
		limit=limit,
		offset=offset,
	)


@frappe.whitelist()
def list_passengers(limit=50, offset=0, search=None):
	or_filters = None
	if search:
		or_filters = {
			"full_name": ["like", f"%{search}%"],
			"id_number": ["like", f"%{search}%"],
			"phone_number": ["like", f"%{search}%"],
		}

	return _paginated(
		"Passenger",
		[
			"name",
			"full_name",
			"id_number",
			"date_of_birth",
			"phone_number",
			"email",
			"passenger_type",
			"nationality",
			"is_active",
			"notes",
		],
		or_filters=or_filters,
		limit=limit,
		offset=offset,
	)


@frappe.whitelist()
def save_flight_route(data):
	if isinstance(data, str):
		import json

		data = json.loads(data)

	name = data.get("name")
	if name:
		doc = frappe.get_doc("Flight Route", name)
		doc.update(data)
	else:
		doc = frappe.get_doc({"doctype": "Flight Route", **data})

	doc.save()
	frappe.db.commit()
	return doc.as_dict()


@frappe.whitelist()
def list_countries():
	return frappe.get_all("Country", fields=["name"], order_by="name asc", limit_page_length=0)


@frappe.whitelist()
def list_crew_members(crew_role=None, for_date=None):
	"""Active crew; optionally filter by role and exclude members assigned on for_date."""
	if crew_role and for_date:
		from bilan_sky.bilan_air_booking_system.api.crew import fetch_available_crew_members

		return fetch_available_crew_members(crew_role, for_date)

	filters = {"status": "Active"}
	if crew_role:
		filters["crew_role"] = crew_role

	return frappe.get_all(
		"Crew Member",
		filters=filters,
		fields=["name", "full_name", "crew_role", "employee_id"],
		order_by="full_name asc",
	)


@frappe.whitelist()
def list_crew_roles(category=None):
	filters = {"is_active": 1}
	if category:
		filters["category"] = category
	return frappe.get_all(
		"Crew Role",
		filters=filters,
		fields=["name", "role_name", "category"],
		order_by="role_name asc",
	)


@frappe.whitelist(allow_guest=True)
def get_display_currency(doc_currency=None):
	"""Default currency + symbol for frontend (company when doc has no currency)."""
	from bilan_sky.bilan_air_booking_system.utils.currency import get_currency_display

	return get_currency_display(doc_currency)


@frappe.whitelist()
def get_print_formats(doctype):
	"""Print format names for Frappe printview."""
	if not doctype:
		return ["Standard"]

	formats = frappe.get_all(
		"Print Format",
		filters={"doc_type": doctype, "disabled": 0},
		pluck="name",
		order_by="name",
	)
	return formats or ["Standard"]


@frappe.whitelist()
def get_portal_user_profile():
	"""Current session user for portal profile UI."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)

	user = frappe.get_doc("User", frappe.session.user)
	return {
		"name": user.name,
		"full_name": user.full_name,
		"first_name": user.first_name or "",
		"last_name": user.last_name or "",
		"email": user.email or "",
		"user_image": user.user_image or "",
		"phone": user.phone or "",
		"mobile_no": user.mobile_no or "",
		"roles": [r.role for r in user.roles],
	}


@frappe.whitelist()
def update_portal_user_profile(data):
	"""Update editable User fields for the logged-in portal user."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)

	if isinstance(data, str):
		import json

		data = json.loads(data)

	user = frappe.get_doc("User", frappe.session.user)
	for field in ("first_name", "last_name", "phone", "mobile_no"):
		if field in data:
			user.set(field, data[field])

	user.save(ignore_permissions=True)
	frappe.db.commit()
	return get_portal_user_profile()


@frappe.whitelist()
def set_portal_user_image(user_image):
	"""Set profile picture URL after upload_file."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not logged in"), frappe.AuthenticationError)

	if not user_image:
		frappe.throw(_("Image URL is required"))

	user = frappe.get_doc("User", frappe.session.user)
	user.user_image = user_image
	user.save(ignore_permissions=True)
	frappe.db.commit()
	return get_portal_user_profile()


@frappe.whitelist()
def get_dashboard_stats():
	return {
		"total_bookings": frappe.db.count("Air Booking"),
		"pending_payments": frappe.db.count("Air Booking", {"payment_status": "Pending"}),
		"upcoming_flights": frappe.db.count(
			"Flight Schedule",
			{"status": ["in", ["Scheduled", "Boarding", "Delayed"]]},
		),
		"available_seats": frappe.db.count("Seat Inventory", {"status": "Available"}),
	}


@frappe.whitelist()
def list_payment_bookings(limit=50, offset=0):
	"""Bookings with payment / invoice context for the payments page."""
	result = list_air_bookings(limit=limit, offset=offset)
	for row in result["data"]:
		row["payment_entry"] = frappe.db.get_value("Air Booking", row["name"], "payment_entry")
		links = frappe.get_all(
			"Air Booking Invoice Link",
			filters={"parent": row["name"]},
			fields=["invoice", "invoice_type"],
			order_by="idx asc",
		)
		for link in links:
			if link.invoice:
				row["sales_invoice"] = link.invoice
				row["invoice_type"] = link.invoice_type
				break
	return result


@frappe.whitelist()
def list_booking_invoices(limit=50, offset=0, search=None):
	"""Sales invoices linked to air bookings."""
	limit = int(limit)
	offset = int(offset)
	search = (search or "").strip()

	conditions = ["link.invoice IS NOT NULL", "link.invoice != ''"]
	params = {"limit": limit, "offset": offset}

	if search:
		like = f"%{search}%"
		conditions.append(
			"""(
			link.invoice LIKE %(search)s
			OR link.parent LIKE %(search)s
			OR ab.payer_name LIKE %(search)s
			OR si.customer LIKE %(search)s
		)"""
		)
		params["search"] = like

	where = " AND ".join(conditions)

	rows = frappe.db.sql(
		f"""
		SELECT
			link.invoice AS name,
			link.invoice_type,
			link.parent AS booking_pnr,
			ab.payer_name,
			ab.payment_status,
			ab.booking_status,
			ab.payment_entry,
			si.customer,
			si.posting_date,
			si.due_date,
			si.grand_total,
			si.outstanding_amount,
			si.status AS invoice_status,
			si.currency,
			si.docstatus
		FROM `tabAir Booking Invoice Link` link
		INNER JOIN `tabAir Booking` ab ON ab.name = link.parent
		LEFT JOIN `tabSales Invoice` si ON si.name = link.invoice
		WHERE {where}
		ORDER BY si.modified DESC, link.modified DESC
		LIMIT %(limit)s OFFSET %(offset)s
		""",
		params,
		as_dict=True,
	)

	count = frappe.db.sql(
		f"""
		SELECT COUNT(*) AS cnt
		FROM `tabAir Booking Invoice Link` link
		INNER JOIN `tabAir Booking` ab ON ab.name = link.parent
		LEFT JOIN `tabSales Invoice` si ON si.name = link.invoice
		WHERE {where}
		""",
		{k: v for k, v in params.items() if k not in ("limit", "offset")},
	)[0][0]

	return {"data": rows, "total": count}


@frappe.whitelist()
def get_booking_invoice_detail(invoice_name):
	"""Sales Invoice with linked air booking context."""
	if not invoice_name or not frappe.db.exists("Sales Invoice", invoice_name):
		frappe.throw(_("Invoice not found"))

	invoice = frappe.get_doc("Sales Invoice", invoice_name)
	invoice.check_permission("read")

	link = frappe.db.get_value(
		"Air Booking Invoice Link",
		{"invoice": invoice_name},
		["parent", "invoice_type"],
		as_dict=True,
	)

	booking = None
	if link and link.parent:
		booking = frappe.db.get_value(
			"Air Booking",
			link.parent,
			[
				"name",
				"payer_name",
				"payer_email",
				"payer_phone",
				"payment_status",
				"booking_status",
				"total_fare",
				"payment_entry",
				"flight_schedule",
			],
			as_dict=True,
		)

	return {
		"name": invoice.name,
		"invoice_type": link.invoice_type if link else None,
		"booking_pnr": link.parent if link else None,
		"customer": invoice.customer,
		"posting_date": invoice.posting_date,
		"due_date": invoice.due_date,
		"grand_total": invoice.grand_total,
		"outstanding_amount": invoice.outstanding_amount,
		"status": invoice.status,
		"currency": invoice.currency,
		"docstatus": invoice.docstatus,
		"remarks": invoice.remarks,
		"booking": booking,
	}
