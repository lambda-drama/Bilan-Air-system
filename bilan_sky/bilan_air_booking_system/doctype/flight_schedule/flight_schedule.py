# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_to_date, cint, cstr, get_datetime

from bilan_sky.bilan_air_booking_system.utils.flight_numbering import (
	assert_unique_flight_number,
	generate_flight_number,
	schedule_document_name,
)
from bilan_sky.bilan_air_booking_system.utils.reservation_status import mark_flight_taken_for_schedule


class FlightSchedule(Document):
    def autoname(self):
        self._ensure_flight_number()
        if self.flight_number and self.departure_date:
            self.name = schedule_document_name(self.flight_number, self.departure_date)

    def validate(self):
        from bilan_sky.bilan_air_booking_system.utils.crew_filters import validate_flight_crew_pilots
        validate_flight_crew_pilots(self)
        self._ensure_flight_number()
        if self.flight_number and self.departure_date:
            assert_unique_flight_number(self.flight_number, self.departure_date, self.name)
            expected_name = schedule_document_name(self.flight_number, self.departure_date)
            if not self.is_new() and self.name != expected_name:
                frappe.rename_doc(self.doctype, self.name, expected_name, force=True)
                self.name = expected_name
        self._sync_segments_and_capacity()

    def _sync_segments_and_capacity(self):
        from bilan_sky.bilan_air_booking_system.utils.flight_segments import sync_schedule_segments_from_route
        from bilan_sky.bilan_air_booking_system.utils.seat_release import aircraft_capacity

        if self.route and not self.segments:
            sync_schedule_segments_from_route(self)
        if self.airplane:
            self.total_aircraft_capacity = aircraft_capacity(self.airplane)

    def after_insert(self):
        self._ensure_seat_inventory()

    def on_update(self):
        self._ensure_seat_inventory()
        if self.has_value_changed("status") and self.status == "Departed":
            mark_flight_taken_for_schedule(self.name)

    def _ensure_seat_inventory(self):
        expected = self._expected_seat_count()
        existing = frappe.db.count("Seat Inventory", {"flight_schedule": self.name})
        if expected > 0 and existing >= expected:
            return existing
        return self.generate_seat_inventory()

    def _expected_seat_count(self):
        """Physical seat count from airplane layout (all seats, including unreleased)."""
        from bilan_sky.bilan_air_booking_system.utils.seat_release import aircraft_capacity

        return aircraft_capacity(self.airplane)

    def _ensure_flight_number(self):
        if self.flight_number and not self.is_new():
            return

        if not (self.airplane and self.route and self.departure_date):
            return

        self.flight_number = generate_flight_number(
            airplane=self.airplane,
            route=self.route,
            departure_date=self.departure_date,
            exclude_name=self.name if not self.is_new() else None,
        )

    # =========================================================
    # SEAT INVENTORY
    # =========================================================

    def generate_seat_inventory(self, raise_on_error=True):
        """Create or backfill Seat Inventory rows from the linked airplane seat configuration."""
        if not self.airplane:
            if raise_on_error:
                frappe.throw(_("Select an airplane before seats can be generated."))
            return 0

        airplane = frappe.get_doc("Airplane", self.airplane)
        if not airplane.seat_config:
            if raise_on_error:
                frappe.throw(
                    _(
                        "Airplane {0} has no seat configuration. Open the Airplane record and add seat rows/columns."
                    ).format(self.airplane)
                )
            return 0

        from bilan_sky.bilan_air_booking_system.utils.seat_release import (
            apply_release_status_to_schedule,
            effective_release_count,
            iter_layout_seat_slots,
        )

        slots = iter_layout_seat_slots(airplane)
        release_count = effective_release_count(self)
        existing_numbers = set(
            frappe.get_all(
                "Seat Inventory",
                filters={"flight_schedule": self.name},
                pluck="seat_number",
            )
        )

        seats_created = 0
        for index, (seat_number, seat_class) in enumerate(slots):
            status = "Available" if index < release_count else "Unreleased"
            if seat_number in existing_numbers:
                continue
            seat = frappe.get_doc(
                {
                    "doctype": "Seat Inventory",
                    "flight_schedule": self.name,
                    "seat_number": seat_number,
                    "seat_class": seat_class,
                    "status": status,
                }
            )
            seat.insert(ignore_permissions=True)
            existing_numbers.add(seat_number)
            seats_created += 1

        self.seats_released_count = release_count
        self.total_aircraft_capacity = len(slots)
        frappe.db.set_value(
            "Flight Schedule",
            self.name,
            {
                "seats_released_count": release_count,
                "total_aircraft_capacity": len(slots),
            },
            update_modified=False,
        )
        apply_release_status_to_schedule(self)

        if seats_created == 0 and not existing_numbers and raise_on_error:
            frappe.throw(
                _(
                    "No seats were created. Check airplane {0}: each cabin needs rows > 0 and valid columns (e.g. A,B,C,D)."
                ).format(self.airplane)
            )

        return len(existing_numbers)
    
    def expected_seat_numbers(self):
        from bilan_sky.bilan_air_booking_system.utils.seat_release import iter_layout_seat_slots

        if not self.airplane:
            return []
        airplane = frappe.get_doc("Airplane", self.airplane)
        return [n for n, _ in iter_layout_seat_slots(airplane)]

    def release_more_seats(self, count: int):
        from bilan_sky.bilan_air_booking_system.utils.seat_release import release_additional_seats

        return release_additional_seats(self.name, count)
    
    def available_seats(self, seat_class=None):
        """Count bookable seats (released and status Available)."""
        filters = {"flight_schedule": self.name, "status": "Available"}
        if seat_class:
            filters["seat_class"] = seat_class
        return frappe.db.count("Seat Inventory", filters)
    
    def reserved_seats(self):
        """Count reserved seats"""
        return frappe.db.count("Seat Inventory", {
            "flight_schedule": self.name,
            "status": "Hold"
        })
    
    def booked_seats(self):
        """Count booked seats"""
        return frappe.db.count("Seat Inventory", {
            "flight_schedule": self.name,
            "status": "Booked"
        })
    
    def total_occupied(self):
        """Count all occupied (reserved + booked)"""
        return self.reserved_seats() + self.booked_seats()
    
    # =========================================================
    # RELEASE EXPIRED SEATS
    # =========================================================
    
    def release_expired_seats(self):
        """Release reserved seats past hold expiry"""
        from frappe.utils import now
        
        expired = frappe.get_all("Seat Inventory", {
            "flight_schedule": self.name,
            "status": ["in", ["Hold", "Reserved"]],
            "hold_expiry": ["<", now()]
        })
        
        for seat_data in expired:
            seat = frappe.get_doc("Seat Inventory", seat_data.name)
            seat.status = "Available"
            seat.hold_expiry = None
            seat.booking_reference = None
            seat.save()
        
        frappe.db.commit()
        
        if expired:
            frappe.msgprint(f"Released {len(expired)} expired seats")
    
    # =========================================================
    # SEAT STATUS UPDATE
    # =========================================================
    
    def reserve_seat(self, seat_number, booking_name, hold_minutes=15):
        """Reserve a seat for booking"""
        from frappe.utils import add_to_date, now
        
        seat = frappe.get_doc("Seat Inventory", {
            "flight_schedule": self.name,
            "seat_number": seat_number
        })
        
        if seat.status != "Available":
            return {"success": False, "message": f"Seat {seat_number} not available"}
        
        seat.status = "Hold"
        seat.booking_reference = booking_name
        seat.hold_expiry = add_to_date(now(), minutes=hold_minutes)
        seat.save()
        frappe.db.commit()
        
        return {"success": True, "message": f"Seat {seat_number} reserved"}
    
    def confirm_seat(self, seat_number, booking_name):
        """Confirm a reserved seat after payment"""
        seat = frappe.get_doc("Seat Inventory", {
            "flight_schedule": self.name,
            "seat_number": seat_number,
            "booking_reference": booking_name
        })
        
        if seat.status not in ("Hold", "Reserved"):
            return {"success": False, "message": f"Seat {seat_number} not reserved for this booking"}
        
        seat.status = "Booked"
        seat.hold_expiry = None
        seat.save()
        frappe.db.commit()
        
        return {"success": True, "message": f"Seat {seat_number} confirmed"}
    
    def cancel_seat(self, seat_number, booking_name):
        """Cancel a booked or reserved seat"""
        seat = frappe.get_doc("Seat Inventory", {
            "flight_schedule": self.name,
            "seat_number": seat_number,
            "booking_reference": booking_name
        })
        
        if seat.status not in ["Hold", "Reserved", "Booked"]:
            return {"success": False, "message": f"Seat {seat_number} not reserved/booked"}
        
        seat.status = "Available"
        seat.hold_expiry = None
        seat.booking_reference = None
        seat.save()
        frappe.db.commit()
        
        return {"success": True, "message": f"Seat {seat_number} cancelled"}


@frappe.whitelist()
def reschedule_flight(
    schedule_name: str,
    reschedule_reason: str,
    new_departure_date: str,
    new_departure_time: str,
    new_arrival_date: str,
    new_arrival_time: str,
    new_airplane: str | None = None,
    notes: str | None = None,
):
    schedule = frappe.get_doc("Flight Schedule", schedule_name)
    schedule.check_permission("write")

    new_departure = get_datetime(f"{new_departure_date} {new_departure_time}")
    new_arrival = get_datetime(f"{new_arrival_date} {new_arrival_time}")
    if new_arrival <= new_departure:
        frappe.throw("New arrival must be after new departure.")

    original_departure_date = schedule.departure_date
    original_departure_time = schedule.departure_time
    original_arrival_date = schedule.arrival_date
    original_arrival_time = schedule.arrival_time
    original_airplane = schedule.airplane

    schedule.departure_date = new_departure_date
    schedule.departure_time = new_departure_time
    schedule.arrival_date = new_arrival_date
    schedule.arrival_time = new_arrival_time
    if new_airplane:
        schedule.airplane = new_airplane

    # Keep booking cutoff aligned with updated departure.
    cutoff_hours = frappe.db.get_single_value("BA Settings", "booking_cutoff_hours") or 2
    schedule.cutoff_datetime = add_to_date(new_departure, hours=-int(cutoff_hours))
    schedule.status = "Delayed"
    schedule.save()

    log = frappe.get_doc(
        {
            "doctype": "Flight Rescheduling Log",
            "flight_schedule": schedule.name,
            "reschedule_reason": reschedule_reason,
            "new_departure_date": new_departure_date,
            "new_departure_time": new_departure_time,
            "new_arrival_date": new_arrival_date,
            "new_arrival_time": new_arrival_time,
            "new_airplane": schedule.airplane,
            "rescheduled_by": frappe.session.user,
            "notes": (
                f"Old: {original_departure_date} {original_departure_time} -> "
                f"{original_arrival_date} {original_arrival_time}; "
                f"Airplane: {original_airplane} -> {schedule.airplane}. "
                f"{notes or ''}"
            ).strip(),
        }
    )
    log.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "flight_schedule": schedule.name,
        "status": schedule.status,
        "rescheduling_log": log.name,
    }