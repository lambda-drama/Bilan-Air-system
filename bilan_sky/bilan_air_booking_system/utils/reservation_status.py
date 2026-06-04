"""Reservation status master data, lookup helpers, and flight-departure transitions."""

import frappe

BOOKED = "Booked"
CONFIRM = "Confirm"
VOID = "Void"
FLIGHT_TAKEN = "Flight Taken"

DEFAULT_STATUSES = (
	(
		BOOKED,
		10,
		"Reservation created. Payment is optional; no PNR is issued yet.",
	),
	(
		CONFIRM,
		20,
		"Customer has paid and the reservation is confirmed. PNR is generated at this stage.",
	),
	(
		VOID,
		30,
		"Reservation cancelled or voided.",
	),
	(
		FLIGHT_TAKEN,
		40,
		"Flight is underway; scheduled departure has commenced.",
	),
)

LEGACY_STATUS_MAP = {
	"Reserved": BOOKED,
	"Paid": CONFIRM,
	"Checked In": CONFIRM,
	"Boarded": CONFIRM,
	"Arrived": FLIGHT_TAKEN,
	"Cancelled": VOID,
	"Refunded": VOID,
}


def ensure_default_statuses():
	"""Create or refresh default Reservation Status records."""
	for status_name, sort_order, description in DEFAULT_STATUSES:
		if frappe.db.exists("Reservation Status", status_name):
			frappe.db.set_value(
				"Reservation Status",
				status_name,
				{"sort_order": sort_order, "description": description, "is_active": 1},
				update_modified=False,
			)
			continue
		doc = frappe.get_doc(
			{
				"doctype": "Reservation Status",
				"status_name": status_name,
				"sort_order": sort_order,
				"description": description,
				"is_active": 1,
			}
		)
		doc.insert(ignore_permissions=True)
	frappe.db.commit()


def map_legacy_status(legacy_status):
	return LEGACY_STATUS_MAP.get(legacy_status) or BOOKED


def resolve_air_booking(identifier, *, throw=True):
	"""Resolve a reservation by internal name (RES-…) or confirmed PNR (BA-…)."""
	key = (identifier or "").strip()
	if not key:
		if throw:
			frappe.throw("Reservation reference is required.")
		return None

	if frappe.db.exists("Air Booking", key):
		return key

	pnr_match = frappe.db.get_value("Air Booking", {"pnr": key}, "name")
	if pnr_match:
		return pnr_match

	if throw:
		frappe.throw(f"Reservation {key} not found.")
	return None


def mark_flight_taken_for_schedule(flight_schedule):
	"""Mark confirmed reservations as Flight Taken when departure has commenced."""
	if not flight_schedule:
		return 0

	names = frappe.get_all(
		"Air Booking",
		filters={
			"flight_schedule": flight_schedule,
			"reservation_status": CONFIRM,
			"docstatus": ["<", 2],
		},
		pluck="name",
	)
	for name in names:
		frappe.db.set_value(
			"Air Booking",
			name,
			"reservation_status",
			FLIGHT_TAKEN,
			update_modified=True,
		)
	if names:
		frappe.db.commit()
	return len(names)
