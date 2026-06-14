# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class FlightSetup(Document):
	def validate(self):
		seen: set[tuple[str, str]] = set()
		for row in self.get("flight_prices") or []:
			if not row.seat_class:
				continue
			key = (row.seat_class, (row.passenger_type or "Adult").strip())
			if key in seen:
				label = frappe.db.get_value("Seat Class", row.seat_class, "class_name") or row.seat_class
				frappe.throw(
					_("Duplicate flight price for {0} / {1}.").format(label, key[1]),
					title=_("Duplicate pricing"),
				)
			seen.add(key)
			if flt(row.fare) < 0:
				frappe.throw(_("Fare cannot be negative for seat class {0}.").format(row.seat_class))

		for row in self.get("flight_penalties") or []:
			if flt(row.amount) < 0:
				frappe.throw(_("Penalty amount cannot be negative."))
