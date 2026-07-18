"""Build IATA Resolution 792 Bar Coded Boarding Pass (BCBP) mandatory data.

Generated on each print from live booking fields — not stored.
Printed symbol is PDF417 (IATA BCBP standard for paper boarding passes / e-tickets).
"""

from __future__ import annotations

import re
from datetime import date, datetime


def _pad(value: str | None, width: int, align: str = "left") -> str:
	text = (value or "")[:width]
	return text.ljust(width) if align == "left" else text.rjust(width)


def _as_date(day: date | datetime | str | None) -> date | None:
	if not day:
		return None
	if isinstance(day, datetime):
		return day.date()
	if isinstance(day, date):
		return day
	text = str(day).strip()[:10]
	try:
		return datetime.strptime(text, "%Y-%m-%d").date()
	except ValueError:
		return None


def _julian_day_of_year(day: date | datetime | str | None) -> str:
	"""IATA flight date field: day-of-year as 3 digits (001–366)."""
	d = _as_date(day)
	if not d:
		return "001"
	return f"{d.timetuple().tm_yday:03d}"


def _parse_flight_number(flight_number: str | None) -> tuple[str, str]:
	"""Return (carrier designator, numeric flight) from values like KQ111 or KQ111-1."""
	raw = (flight_number or "").upper().strip()
	raw = re.sub(r"-\d+$", "", raw)
	match = re.match(r"^([A-Z]{2,3})\s*(\d+)$", raw)
	if match:
		return match.group(1), match.group(2)
	digits = re.sub(r"\D", "", raw) or "0"
	return "BA", digits


def _format_passenger_name(passenger_name: str | None) -> str:
	"""Surname/GivenNames, fixed 20 characters (IATA BCBP)."""
	parts = [p for p in re.split(r"[\s,]+", (passenger_name or "").upper().strip()) if p]
	if len(parts) >= 2:
		surname = parts[-1]
		given = " ".join(parts[:-1])
		formatted = f"{surname}/{given}"
	elif parts:
		formatted = f"{parts[0]}/"
	else:
		formatted = "PASSENGER/"
	return _pad(formatted, 20)


def _format_pnr(pnr: str | None) -> str:
	clean = re.sub(r"[^A-Z0-9]", "", (pnr or "").upper())
	return _pad(clean or "XXXXXXX", 7)


def _format_carrier(carrier: str) -> str:
	return _pad(carrier.upper(), 3)


def _format_flight_number_field(numeric: str) -> str:
	"""5-character flight number field: usually 4 digits + trailing space."""
	try:
		num = int(re.sub(r"\D", "", numeric) or "0")
	except ValueError:
		num = 0
	return f"{num:04d} "


def _format_seat(seat: str | None) -> str:
	clean = re.sub(r"\s+", "", (seat or "").upper())
	if not clean:
		return "    "
	return _pad(clean, 4)


def _compartment_code(seat_class: str | None) -> str:
	label = (seat_class or "").upper()
	if "FIRST" in label:
		return "F"
	if "BUSINESS" in label:
		return "C"
	if "PREMIUM" in label:
		return "W"
	return "Y"


def build_iata_bcbp(
	*,
	passenger_name: str | None,
	pnr: str | None,
	origin_code: str | None,
	destination_code: str | None,
	flight_number: str | None,
	departure_date: str | date | datetime | None,
	seat: str | None = None,
	sequence_no: int | str | None = 1,
	seat_class: str | None = None,
	passenger_status: str = "0",
	electronic_ticket: bool = True,
) -> str:
	"""
	Build the mandatory unique + first-leg BCBP string (60 characters when no variable data).

	passenger_status: 0 issued, 1 checked-in, 2 boarded, 3 standby OK, …
	"""
	carrier, flight_num = _parse_flight_number(flight_number)
	try:
		seq = int(sequence_no or 1)
	except (TypeError, ValueError):
		seq = 1
	status = (passenger_status or "0")[:1]

	parts = [
		"M",  # Format code
		"1",  # Number of legs
		_format_passenger_name(passenger_name),
		"E" if electronic_ticket else " ",
		_format_pnr(pnr),
		_pad((origin_code or "").upper(), 3),
		_pad((destination_code or "").upper(), 3),
		_format_carrier(carrier),
		_format_flight_number_field(flight_num),
		_julian_day_of_year(departure_date),
		_compartment_code(seat_class),
		_format_seat(seat),
		f"{max(seq, 0):05d}",
		status,
		"00",  # No following variable-size field
	]
	return "".join(parts)
