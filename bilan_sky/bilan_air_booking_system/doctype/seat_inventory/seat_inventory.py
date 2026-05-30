# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

# import frappe


import frappe
from frappe.model.document import Document
from frappe.utils import now, add_to_date, get_datetime

class SeatInventory(Document):
    
    # =========================================================
    # STATUS HELPERS
    # =========================================================
    
    def is_available(self):
        """Check if seat is available"""
        return self.status == "Available"
    
    def is_reserved(self):
        """Check if seat is on hold (supports legacy 'Reserved')."""
        return self.status in ("Hold", "Reserved")
    
    def is_booked(self):
        """Check if seat is booked"""
        return self.status == "Booked"
    
    def is_occupied(self):
        """Check if seat is occupied"""
        return self.status == "Occupied"
    
    # =========================================================
    # RESERVATION METHODS
    # =========================================================
    
    def reserve(self, booking_name, hold_minutes=15):
        """
        Reserve this seat for a booking
        
        Args:
            booking_name: Name of Air Booking document
            hold_minutes: How long to hold the seat (default from settings)
        
        Returns:
            dict: Success status and message
        """
        
        if not self.is_available():
            return {
                "success": False, 
                "message": f"Seat {self.seat_number} is {self.status.lower()}"
            }
        
        # Get hold duration from settings if not specified
        if hold_minutes == 15:
            settings = frappe.get_single("BA Settings")
            hold_minutes = settings.hold_duration
        
        # Put the seat on hold until payment.
        self.status = "Hold"
        self.booking_reference = booking_name
        self.hold_expiry = add_to_date(now(), minutes=hold_minutes)
        self.save()
        frappe.db.commit()
        
        return {
            "success": True, 
            "message": f"Seat {self.seat_number} on hold until {self.hold_expiry}"
        }
    
    def confirm(self, booking_name):
        """
        Confirm a held seat after payment
        
        Args:
            booking_name: Name of Air Booking document
        
        Returns:
            dict: Success status and message
        """
        
        if not self.is_reserved():
            return {
                "success": False,
                "message": f"Seat {self.seat_number} is not on hold"
            }
        
        if self.booking_reference != booking_name:
            return {
                "success": False,
                "message": f"Seat {self.seat_number} is held for different booking"
            }
        
        # Confirm the seat
        self.status = "Booked"
        self.hold_expiry = None
        self.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Seat {self.seat_number} confirmed for {booking_name}"
        }
    
    def release(self, booking_name=None):
        """
        Release a held or booked seat
        
        Args:
            booking_name: Optional, to verify ownership
        
        Returns:
            dict: Success status and message
        """
        
        if self.is_available():
            return {
                "success": False,
                "message": f"Seat {self.seat_number} is already available"
            }
        
        # Check ownership if booking name provided
        if booking_name and self.booking_reference != booking_name:
            return {
                "success": False,
                "message": f"Seat {self.seat_number} belongs to different booking"
            }
        
        # Release the seat
        self.status = "Available"
        self.hold_expiry = None
        self.booking_reference = None
        self.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Seat {self.seat_number} released"
        }
    
    def occupy(self):
        """
        Mark seat as occupied (passenger boarded)
        
        Returns:
            dict: Success status and message
        """
        
        if not self.is_booked():
            return {
                "success": False,
                "message": f"Seat {self.seat_number} is not booked"
            }
        
        self.status = "Occupied"
        self.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Seat {self.seat_number} marked as occupied"
        }
    
    # =========================================================
    # EXPIRY CHECK
    # =========================================================
    
    def is_expired(self):
        """Check if a held seat has expired"""
        
        if not self.is_reserved():
            return False
        
        if not self.hold_expiry:
            return False
        
        return get_datetime(now()) > get_datetime(self.hold_expiry)
    
    def release_if_expired(self):
        """Release seat if reservation has expired"""
        
        if self.is_expired():
            return self.release()
        
        return {
            "success": False,
            "message": f"Seat {self.seat_number} has not expired"
        }
    
    # =========================================================
    # TIME REMAINING
    # =========================================================
    
    def minutes_remaining(self):
        """Get minutes remaining before hold expires"""
        
        if not self.is_reserved():
            return 0
        
        if not self.hold_expiry:
            return 0
        
        from frappe.utils import time_diff_in_seconds
        seconds_left = time_diff_in_seconds(self.hold_expiry, now())
        
        if seconds_left <= 0:
            return 0
        
        return int(seconds_left / 60)
    
    # =========================================================
    # PRICE CALCULATION
    # =========================================================
    
    def get_current_price(self, booking_date=None):
        """
        Calculate current price for this seat
        
        Args:
            booking_date: Date of booking (defaults to now)
        
        Returns:
            float: Current price
        """
        
        from frappe.utils import date_diff, getdate
        
        if not booking_date:
            booking_date = now()
        
        # Get flight schedule
        flight = frappe.get_doc("Flight Schedule", self.flight_schedule)
        route = frappe.get_doc("Flight Route", flight.route)
        
        # Get seat class multiplier
        seat_class = frappe.get_doc("Seat Class", self.seat_class)
        class_multiplier = seat_class.price_multiplier
        
        # Get base fare (use override if exists)
        base_fare = flight.base_fare_override or route.base_fare
        
        # Apply fare rule based on days before departure
        days_before = date_diff(flight.departure_date, getdate(booking_date))
        
        fare_rule = frappe.get_all("Fare Rule",
            filters={
                "route": flight.route,
                "days_before_departure": [">=", days_before],
                "is_active": 1,
            },
            order_by="days_before_departure asc",
            limit=1
        )
        
        fare_multiplier = 1.0
        if fare_rule:
            rule = frappe.get_doc("Fare Rule", fare_rule[0].name)
            fare_multiplier = 1 + (rule.price_increase_percentage / 100)
        
        # Calculate final price
        price = base_fare * class_multiplier * fare_multiplier
        
        return round(price, 2)
    
    # =========================================================
    # BULK OPERATIONS (Class Methods)
    # =========================================================
    
    @classmethod
    def get_available_by_flight(cls, flight_schedule_name, seat_class=None):
        """Get all available seats for a flight"""
        
        filters = {
            "flight_schedule": flight_schedule_name,
            "status": "Available"
        }
        
        if seat_class:
            filters["seat_class"] = seat_class
        
        return frappe.get_all("Seat Inventory", filters, ["name", "seat_number", "seat_class"])
    
    @classmethod
    def get_reserved_by_flight(cls, flight_schedule_name):
        """Get all seats currently on hold for a flight."""
        
        return frappe.get_all("Seat Inventory", {
            "flight_schedule": flight_schedule_name,
            "status": ["in", ["Hold", "Reserved"]]
        }, ["name", "seat_number", "booking_reference", "hold_expiry"])
    
    @classmethod
    def get_booked_by_flight(cls, flight_schedule_name):
        """Get all booked seats for a flight"""
        
        return frappe.get_all("Seat Inventory", {
            "flight_schedule": flight_schedule_name,
            "status": "Booked"
        }, ["name", "seat_number", "booking_reference"])
    
    @classmethod
    def release_all_expired(cls):
        """Release all expired holds across all flights"""
        
        from frappe.utils import now
        
        expired = frappe.get_all("Seat Inventory", {
            "status": ["in", ["Hold", "Reserved"]],
            "hold_expiry": ["<", now()]
        })
        
        released = 0
        for seat_data in expired:
            seat = frappe.get_doc("Seat Inventory", seat_data.name)
            result = seat.release_if_expired()
            if result["success"]:
                released += 1
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Released {released} expired seats"
        }


def prepare_seat_for_new_booking(seat_name, current_booking=None):
    """Release stale holds so a seat can be used for a new booking attempt."""
    if not seat_name or not frappe.db.exists("Seat Inventory", seat_name):
        return

    seat = frappe.get_doc("Seat Inventory", seat_name)

    if current_booking and seat.booking_reference == current_booking:
        return

    if seat.status in ("Hold", "Reserved"):
        seat.release_if_expired()
        seat.reload()

    if seat.status in ("Hold", "Reserved") and seat.booking_reference:
        booking_status = frappe.db.get_value(
            "Air Booking", seat.booking_reference, "booking_status"
        )
        if booking_status == "Cancelled":
            seat.status = "Available"
            seat.booking_reference = None
            seat.hold_expiry = None
            seat.save(ignore_permissions=True)