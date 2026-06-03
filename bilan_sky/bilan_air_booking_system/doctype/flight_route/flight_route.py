# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
	format_route_name,
	get_next_flight_series_base,
)


class FlightRoute(Document):
	def validate(self):
		self._set_route_name()
		if not self.flight_series_base:
			self.flight_series_base = get_next_flight_series_base()
		self._sync_base_fares()

	def _sync_base_fares(self):
		from bilan_sky.bilan_air_booking_system.utils.fare_pricing import normalize_base_fares

		fares = normalize_base_fares(self.base_fares, legacy_adult=self.base_fare)
		self.base_fares = fares
		self.base_fare = fares["adult"]

	def autoname(self):
		self._set_route_name()
		self.name = self.route_name

	def _set_route_name(self):
		if self.origin_airport and self.destination_airport:
			if self.origin_airport == self.destination_airport:
				frappe.throw("Origin and destination airports cannot be the same.")
			self.route_name = format_route_name(self.origin_airport, self.destination_airport)
