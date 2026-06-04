"""Backfill single-segment routes and release counts on existing schedules."""

import frappe
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.utils.seat_release import (
	apply_release_status_to_schedule,
	aircraft_capacity,
)


def execute():
	if not frappe.db.table_exists("tabFlight Route"):
		return

	for route_name in frappe.get_all("Flight Route", pluck="name"):
		route = frappe.get_doc("Flight Route", route_name)
		if route.route_segments:
			continue
		if route.origin_airport and route.destination_airport:
			frappe.get_doc(
				{
					"doctype": "Flight Route Segment",
					"parent": route.name,
					"parenttype": "Flight Route",
					"parentfield": "route_segments",
					"segment_index": 0,
					"origin_airport": route.origin_airport,
					"destination_airport": route.destination_airport,
				}
			).insert(ignore_permissions=True)

	if frappe.db.table_exists("tabFlight Schedule"):
		for name in frappe.get_all("Flight Schedule", pluck="name"):
			doc = frappe.get_doc("Flight Schedule", name)
			if not doc.segments and doc.route:
				from bilan_sky.bilan_air_booking_system.utils.flight_segments import (
					sync_schedule_segments_from_route,
				)

				sync_schedule_segments_from_route(doc)
				doc.save(ignore_permissions=True)

			capacity = aircraft_capacity(doc.airplane) if doc.airplane else 0
			released = cint(doc.seats_released_count or doc.initial_seats_released or capacity)
			if capacity and not doc.seats_released_count:
				frappe.db.set_value(
					"Flight Schedule",
					name,
					{
						"total_aircraft_capacity": capacity,
						"seats_released_count": min(released, capacity),
					},
					update_modified=False,
				)
				doc.reload()
				apply_release_status_to_schedule(doc)

	frappe.db.commit()
