"""Serialize Flight Route for portal APIs."""

from __future__ import annotations

import frappe
from frappe.utils import cint

from bilan_sky.bilan_air_booking_system.utils.airports import enrich_route_airport_labels
from bilan_sky.bilan_air_booking_system.utils.fare_pricing import route_fares_for_api
from bilan_sky.bilan_air_booking_system.utils.flight_segments import get_route_segments


def serialize_route_segments(route_name: str | None = None, doc=None) -> list[dict]:
	segments = get_route_segments(route_name) if route_name else []
	if doc and getattr(doc, "route_segments", None):
		segments = [
			{
				"segment_index": cint(row.segment_index),
				"origin_airport": row.origin_airport,
				"destination_airport": row.destination_airport,
			}
			for row in sorted(doc.route_segments, key=lambda r: cint(r.segment_index))
		]
	return segments


def segments_summary(segments: list[dict]) -> str:
	if not segments:
		return ""
	if len(segments) == 1:
		return f"{segments[0]['origin_airport']} → {segments[0]['destination_airport']}"
	try:
		from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
			format_multi_segment_route_name,
		)

		if len(segments) >= 2:
			return format_multi_segment_route_name(segments)
	except Exception:
		pass
	parts = [segments[0]["origin_airport"]]
	for seg in segments:
		parts.append(seg["destination_airport"])
	return " → ".join(parts)


def serialize_flight_route(doc) -> dict:
	row = doc.as_dict()
	segments = serialize_route_segments(doc=doc)
	row["route_segments"] = segments
	row["is_multi_segment"] = cint(getattr(doc, "is_multi_segment", 0))
	row["segment_count"] = len(segments)
	row["segments_summary"] = segments_summary(segments)
	enrich_route_airport_labels(row)
	for seg in segments:
		enrich_route_airport_labels(seg)
	row.update(route_fares_for_api(doc))
	return row


def apply_route_segments_to_doc(doc, segments: list | None) -> None:
	if segments is None:
		return
	doc.route_segments = []
	for seg in segments or []:
		doc.append(
			"route_segments",
			{
				"segment_index": cint(seg.get("segment_index", len(doc.route_segments))),
				"origin_airport": (seg.get("origin_airport") or "").strip(),
				"destination_airport": (seg.get("destination_airport") or "").strip(),
			},
		)
