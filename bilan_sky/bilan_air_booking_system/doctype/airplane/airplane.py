# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import cint, cstr


class Airplane(Document):
	def validate(self):
		self.total_seats = self._get_total_seats()

	def autoname(self):
		model = cstr(self.aircraft_model).strip()
		reg = cstr(self.registration_number).strip()

		if model and reg:
			self.name = f"{model} - {reg}"
		else:
			# Fallback (shouldn't happen since both are required)
			self.name = reg or model

	def _get_total_seats(self) -> int:
		total = 0

		for row in self.get("seat_config") or []:
			rows = cint(getattr(row, "rows", 0))
			columns_per_row = cstr(getattr(row, "columns_per_row", "")).strip()

			# Stored like: "A,B,C,D,E,F" -> 6 seats per row
			seat_letters = [c.strip() for c in columns_per_row.split(",") if c.strip()]
			seats_per_row = len(seat_letters)

			total += max(rows, 0) * max(seats_per_row, 0)

		return cint(total)
