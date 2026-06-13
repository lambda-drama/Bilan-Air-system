"""Flight schedule flags that control public booking and payment rules."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint


def schedule_booking_flags(schedule_name: str | None) -> dict[str, int]:
	if not schedule_name or not frappe.db.exists("Flight Schedule", schedule_name):
		return {"is_active": 0, "only_prepayment": 0}
	row = frappe.db.get_value(
		"Flight Schedule",
		schedule_name,
		["is_active", "only_prepayment"],
		as_dict=True,
	)
	return {
		"is_active": cint(row.is_active) if row else 0,
		"only_prepayment": cint(row.only_prepayment) if row else 0,
	}


def assert_schedule_active_for_booking(schedule_name: str | None) -> None:
	if not schedule_name:
		return
	if not cint(frappe.db.get_value("Flight Schedule", schedule_name, "is_active")):
		frappe.throw(_("This flight is not open for booking."))


def assert_credit_confirmation_allowed(schedule_name: str | None) -> None:
	"""Block agent-credit confirmation when the schedule requires upfront payment."""
	if not schedule_name:
		return
	if cint(frappe.db.get_value("Flight Schedule", schedule_name, "only_prepayment")):
		frappe.throw(
			_(
				"This flight is marked Only Pre-Payment. Confirm with payment — agent credit is not allowed."
			)
		)
