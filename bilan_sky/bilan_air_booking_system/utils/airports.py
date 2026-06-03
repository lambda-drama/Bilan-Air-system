# Copyright (c) 2026, NF and contributors

import frappe


def resolve_airport_name(origin_or_iata: str) -> str | None:
	"""Resolve Airport document name from link name or IATA code."""
	code = (origin_or_iata or "").strip()
	if not code:
		return None
	if frappe.db.exists("Airport", code):
		return code
	return frappe.db.get_value("Airport", {"iata_code": code.upper()}, "name")


def get_airport_iata(airport_name: str) -> str | None:
	return frappe.db.get_value("Airport", airport_name, "iata_code")


def airport_display_label(airport_link: str | None) -> str:
	"""Human-readable airport label, e.g. Nairobi(NBO)."""
	if not airport_link:
		return ""
	row = frappe.db.get_value(
		"Airport",
		airport_link,
		["city", "airport_name", "iata_code"],
		as_dict=True,
	)
	if not row:
		return str(airport_link)
	place = (row.get("city") or row.get("airport_name") or "").strip()
	iata = (row.get("iata_code") or "").strip().upper()
	if not iata:
		iata = str(airport_link).strip().upper()
	if place and iata:
		return f"{place}({iata})"
	return place or iata


def enrich_route_airport_labels(route: dict) -> dict:
	"""Add origin_airport_label and destination_airport_label to a route dict."""
	if route.get("origin_airport"):
		route["origin_airport_label"] = airport_display_label(route["origin_airport"])
	if route.get("destination_airport"):
		route["destination_airport_label"] = airport_display_label(route["destination_airport"])
	return route


def format_route_label(origin_airport: str | None, destination_airport: str | None) -> str:
	origin = airport_display_label(origin_airport)
	destination = airport_display_label(destination_airport)
	if origin and destination:
		return f"{origin} → {destination}"
	return origin or destination or ""
