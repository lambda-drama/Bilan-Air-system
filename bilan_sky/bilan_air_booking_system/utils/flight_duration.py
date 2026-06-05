"""Route duration helpers and schedule arrival estimates."""

from __future__ import annotations

import frappe
from frappe.utils import add_to_date, cint, get_datetime, getdate


def duration_to_seconds(value) -> int:
	"""Frappe Duration fields are stored as seconds."""
	if value is None or value == "":
		return 0
	try:
		seconds = int(value)
	except (TypeError, ValueError):
		return 0
	return max(0, seconds)


def get_route_total_duration_seconds(route_name: str) -> int:
	"""Total estimated en-route time: sum of segment durations, else route.duration."""
	if not route_name:
		return 0

	from bilan_sky.bilan_air_booking_system.utils.flight_segments import get_route_segments

	if cint(frappe.db.get_value("Flight Route", route_name, "is_multi_segment")):
		segments = get_route_segments(route_name)
		total = sum(duration_to_seconds(row.get("duration")) for row in segments)
		if total:
			return total

	route_columns = set(frappe.db.get_table_columns("Flight Route") or [])
	if "duration" in route_columns:
		return duration_to_seconds(frappe.db.get_value("Flight Route", route_name, "duration"))
	return 0


def estimate_arrival_datetime(departure_date, departure_time, duration_seconds: int) -> dict | None:
	if not (departure_date and departure_time and duration_seconds > 0):
		return None

	departure = get_datetime(f"{getdate(departure_date)} {departure_time}")
	arrival = add_to_date(departure, seconds=duration_seconds)
	return {
		"arrival_date": str(arrival.date()),
		"arrival_time": arrival.strftime("%H:%M:%S"),
	}


def estimate_schedule_arrival(route: str, departure_date, departure_time) -> dict:
	"""Return overall and per-segment arrival estimates from route duration(s)."""
	total_seconds = get_route_total_duration_seconds(route)
	overall = estimate_arrival_datetime(departure_date, departure_time, total_seconds)

	segment_rows = []
	if route and departure_date and departure_time:
		from bilan_sky.bilan_air_booking_system.utils.flight_segments import get_route_segments

		current = get_datetime(f"{getdate(departure_date)} {departure_time}")
		for row in get_route_segments(route):
			leg_seconds = duration_to_seconds(row.get("duration"))
			if leg_seconds <= 0:
				segment_rows.append(
					{
						"segment_index": row["segment_index"],
						"origin_airport": row["origin_airport"],
						"destination_airport": row["destination_airport"],
						"duration": leg_seconds or None,
						"arrival_date": None,
						"arrival_time": None,
					}
				)
				continue

			arrival = add_to_date(current, seconds=leg_seconds)
			segment_rows.append(
				{
					"segment_index": row["segment_index"],
					"origin_airport": row["origin_airport"],
					"destination_airport": row["destination_airport"],
					"duration": leg_seconds,
					"arrival_date": str(arrival.date()),
					"arrival_time": arrival.strftime("%H:%M:%S"),
				}
			)
			current = arrival

	result = {
		"total_duration_seconds": total_seconds or None,
		"segments": segment_rows,
	}
	if overall:
		result.update(overall)
	return result
