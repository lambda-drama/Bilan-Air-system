"""Multi-stop flight segments and per-journey seat availability."""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.utils.airports import resolve_airport_name


def _segment_rows(parent_doctype: str, parent_name: str) -> list[dict]:
	rows = frappe.get_all(
		f"{parent_doctype} Segment",
		filters={"parent": parent_name},
		fields=["segment_index", "origin_airport", "destination_airport"],
		order_by="segment_index asc",
	)
	if rows:
		return rows
	return []


def get_route_segments(route_name: str) -> list[dict]:
	if not route_name:
		return []
	route = frappe.get_doc("Flight Route", route_name)
	if getattr(route, "is_multi_segment", 0) and route.route_segments:
		return [
			{
				"segment_index": cint(row.segment_index),
				"origin_airport": row.origin_airport,
				"destination_airport": row.destination_airport,
			}
			for row in sorted(route.route_segments, key=lambda r: cint(r.segment_index))
		]
	if route.origin_airport and route.destination_airport:
		return [
			{
				"segment_index": 0,
				"origin_airport": route.origin_airport,
				"destination_airport": route.destination_airport,
			}
		]
	return []


def get_schedule_segments(schedule_name: str) -> list[dict]:
	if not schedule_name:
		return []
	segments = _segment_rows("Flight Schedule", schedule_name)
	if segments:
		return segments
	schedule = frappe.get_doc("Flight Schedule", schedule_name)
	return get_route_segments(schedule.route)


def schedule_is_multi_segment(schedule_name: str) -> bool:
	return len(get_schedule_segments(schedule_name)) > 1


def validate_route_segments(segments: list) -> None:
	if not segments:
		frappe.throw(_("Add at least one flight segment."))
	ordered = sorted(segments, key=lambda r: cint(r.segment_index if hasattr(r, "segment_index") else r.get("segment_index")))
	for idx, row in enumerate(ordered):
		expected = idx if len(ordered) > 1 else cint(
			row.segment_index if hasattr(row, "segment_index") else row.get("segment_index", 0)
		)
		origin = row.origin_airport if hasattr(row, "origin_airport") else row.get("origin_airport")
		dest = row.destination_airport if hasattr(row, "destination_airport") else row.get("destination_airport")
		if not origin or not dest:
			frappe.throw(_("Each segment needs a from and to airport."))
		if origin == dest:
			frappe.throw(_("Segment {0}: origin and destination cannot be the same.").format(expected + 1))
		if idx > 0:
			prev = ordered[idx - 1]
			prev_dest = (
				prev.destination_airport
				if hasattr(prev, "destination_airport")
				else prev.get("destination_airport")
			)
			if prev_dest != origin:
				frappe.throw(
					_("Segment {0} must depart from the previous segment's destination ({1}).").format(
						expected + 1, prev_dest
					)
				)


def sync_schedule_segments_from_route(schedule) -> None:
	segments = get_route_segments(schedule.route)
	schedule.segments = []
	for row in segments:
		schedule.append(
			"segments",
			{
				"segment_index": row["segment_index"],
				"origin_airport": row["origin_airport"],
				"destination_airport": row["destination_airport"],
			},
		)


def resolve_airport_on_schedule(schedule_name: str, airport) -> str | None:
	return resolve_airport_name(airport)


def segment_ranges_overlap(from_a: int, to_a: int, from_b: int, to_b: int) -> bool:
	"""Inclusive segment index ranges overlap."""
	return not (to_a < from_b or to_b < from_a)


def get_active_allocations_for_seat(seat_inventory: str, exclude_booking: str | None = None) -> list[dict]:
	filters = {
		"seat_inventory": seat_inventory,
		"status": ["in", ["Hold", "Booked"]],
	}
	rows = frappe.get_all(
		"Seat Segment Allocation",
		filters=filters,
		fields=[
			"name",
			"air_booking",
			"from_segment_index",
			"to_segment_index",
			"status",
			"boarding_airport",
			"deboarding_airport",
		],
	)
	if exclude_booking:
		rows = [r for r in rows if r.air_booking != exclude_booking]
	return rows


def seat_available_for_journey(
	seat_inventory: str,
	schedule_name: str,
	from_segment_index: int,
	to_segment_index: int,
	*,
	exclude_booking: str | None = None,
) -> bool:
	seat = frappe.db.get_value(
		"Seat Inventory",
		seat_inventory,
		["status", "flight_schedule"],
		as_dict=True,
	)
	if not seat or seat.flight_schedule != schedule_name:
		return False
	if seat.status == "Unreleased":
		return False

	if not schedule_is_multi_segment(schedule_name):
		return seat.status == "Available"

	if seat.status in ("Hold", "Booked", "Occupied") and seat.booking_reference:
		if exclude_booking and seat.booking_reference == exclude_booking:
			pass
		else:
			return False

	for alloc in get_active_allocations_for_seat(seat_inventory, exclude_booking=exclude_booking):
		if segment_ranges_overlap(
			from_segment_index,
			to_segment_index,
			alloc.from_segment_index,
			alloc.to_segment_index,
		):
			return False
	return True


def route_serves_journey(route_name: str, boarding_airport, deboarding_airport) -> bool:
	"""True if this route has a valid segment path between the two airports."""
	board = resolve_airport_name(boarding_airport)
	deboard = resolve_airport_name(deboarding_airport)
	if not board or not deboard:
		return False
	segments = get_route_segments(route_name)
	if not segments:
		return False
	try:
		resolve_journey_segment_range_from_segments(segments, board, deboard)
		return True
	except frappe.ValidationError:
		return False


def resolve_journey_segment_range_from_segments(segments: list[dict], board: str, deboard: str):
	origin_to_idx = {s["origin_airport"]: s["segment_index"] for s in segments}
	dest_to_idx = {s["destination_airport"]: s["segment_index"] for s in segments}
	if board not in origin_to_idx:
		frappe.throw(_("Passengers cannot board at {0} on this flight.").format(board))
	if deboard not in dest_to_idx:
		frappe.throw(_("Passengers cannot deboard at {0} on this flight.").format(deboard))
	from_idx = origin_to_idx[board]
	to_idx = dest_to_idx[deboard]
	if from_idx > to_idx:
		frappe.throw(
			_("Invalid journey: {0} to {1} is not in the direction of travel.").format(board, deboard)
		)
	return from_idx, to_idx


def resolve_journey_segment_range(
	schedule_name: str, boarding_airport, deboarding_airport
) -> tuple[int, int]:
	"""Return inclusive from/to segment indices for a passenger journey."""
	board = resolve_airport_on_schedule(schedule_name, boarding_airport)
	deboard = resolve_airport_on_schedule(schedule_name, deboarding_airport)
	if not board or not deboard:
		frappe.throw(_("Invalid boarding or deboarding airport for this flight."))
	if board == deboard:
		frappe.throw(_("Boarding and deboarding airports must be different."))

	segments = get_schedule_segments(schedule_name)
	if not segments:
		frappe.throw(_("This flight has no segment configuration."))

	return resolve_journey_segment_range_from_segments(segments, board, deboard)


def count_seats_available_for_journey(
	schedule_name: str,
	boarding_airport,
	deboarding_airport,
	*,
	exclude_booking: str | None = None,
) -> int:
	from_idx, to_idx = resolve_journey_segment_range(schedule_name, boarding_airport, deboarding_airport)
	seats = frappe.get_all(
		"Seat Inventory",
		filters={"flight_schedule": schedule_name, "status": ["!=", "Unreleased"]},
		pluck="name",
	)
	count = 0
	for seat_name in seats:
		if seat_available_for_journey(
			seat_name, schedule_name, from_idx, to_idx, exclude_booking=exclude_booking
		):
			count += 1
	return count
