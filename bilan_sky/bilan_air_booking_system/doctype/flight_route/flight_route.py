# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
	format_route_name,
	get_next_flight_series_base,
)


class FlightRoute(Document):
	def validate(self):
		self._validate_segments()
		self._set_route_name()
		if not self.flight_series_base:
			self.flight_series_base = get_next_flight_series_base()
		self._sync_base_fares()

	def _validate_segments(self):
		from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
			validate_route_segments,
		)

		if self.is_multi_segment:
			if not self.route_segments:
				frappe.throw(_("Add route segments for a multi-segment route."))
			if len(self.route_segments) < 2:
				frappe.throw(
					_(
						"Multi-segment routes need at least two legs. "
						"Use a direct route for a single origin–destination pair."
					)
				)
			validate_route_segments(self.route_segments)
			first = min(self.route_segments, key=lambda r: r.segment_index)
			last = max(self.route_segments, key=lambda r: r.segment_index)
			self.origin_airport = first.origin_airport
			self.destination_airport = last.destination_airport
		else:
			if self.origin_airport and self.destination_airport:
				self.route_segments = []
				self.append(
					"route_segments",
					{
						"segment_index": 0,
						"origin_airport": self.origin_airport,
						"destination_airport": self.destination_airport,
					},
				)

	def _sync_base_fares(self):
		from bilan_sky.bilan_air_booking_system.utils.fare_pricing import sync_route_base_fare_fields

		sync_route_base_fare_fields(self)

	def autoname(self):
		self._validate_segments()
		self._set_route_name()
		self.name = self.route_name

	def _set_route_name(self):
		if not self.origin_airport or not self.destination_airport:
			return
		if self.origin_airport == self.destination_airport:
			frappe.throw(_("Origin and destination airports cannot be the same."))

		route_name = format_route_name(
			self.origin_airport,
			self.destination_airport,
			route_segments=self.route_segments if self.is_multi_segment else None,
			is_multi_segment=bool(self.is_multi_segment),
		)

		if self.is_new() and frappe.db.exists("Flight Route", route_name):
			if self.is_multi_segment:
				frappe.throw(
					_(
						"Flight Route {0} already exists. "
						"Multi-stop paths are named by the full journey "
						"(e.g. ADI-NBO-MBA for ADI→NBO→MBA). "
						"Add or reorder legs so the path name is unique."
					).format(route_name)
				)
			frappe.throw(_("Flight Route {0} already exists.").format(route_name))

		self.route_name = route_name


@frappe.whitelist()
def preview_route_name(
	origin_airport=None,
	destination_airport=None,
	is_multi_segment=0,
	segments=None,
):
	"""Desk/portal: preview document name before save."""
	import json

	if isinstance(segments, str):
		segments = json.loads(segments) if segments else []

	class _Seg:
		pass

	rows = []
	for seg in segments or []:
		row = _Seg()
		row.segment_index = seg.get("segment_index", 0)
		row.origin_airport = seg.get("origin_airport")
		row.destination_airport = seg.get("destination_airport")
		rows.append(row)

	if cint(is_multi_segment) and rows:
		from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
			format_multi_segment_route_name,
		)

		return format_multi_segment_route_name(rows)

	if origin_airport and destination_airport:
		return format_route_name(origin_airport, destination_airport)
	return None
