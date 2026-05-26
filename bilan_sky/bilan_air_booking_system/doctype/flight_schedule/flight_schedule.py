# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

# import frappe
import frappe
from frappe.model.document import Document

class FlightSchedule(Document):
    
    # =========================================================
    # SEAT INVENTORY
    # =========================================================
    
    def generate_seat_inventory(self):
        """Create seat records for this flight from airplane config"""
        
        # Check if already exists
        if frappe.db.exists("Seat Inventory", {"flight_schedule": self.name}):
            frappe.msgprint("Seats already generated")
            return
        
        # Get airplane seat config
        airplane = frappe.get_doc("Airplane", self.airplane)
        
        if not airplane.seat_config:
            frappe.msgprint("No seat configuration found")
            return
        
        seats_created = 0
        
        for config in airplane.seat_config:
            seat_class = config.seat_class
            rows = config.rows
            columns = config.columns_per_row.split(",")
            start_row = config.start_row_number or 1
            
            for row in range(start_row, start_row + rows):
                for col in columns:
                    seat_number = f"{row}{col.strip()}"
                    
                    seat = frappe.get_doc({
                        "doctype": "Seat Inventory",
                        "flight_schedule": self.name,
                        "seat_number": seat_number,
                        "seat_class": seat_class,
                        "status": "Available"
                    })
                    seat.insert()
                    seats_created += 1
        
        frappe.db.commit()
        frappe.msgprint(f"Created {seats_created} seats")
    
    # =========================================================
    # SEAT AVAILABILITY
    # =========================================================
    
    def available_seats(self, seat_class=None):
        """Count available seats"""
        filters = {"flight_schedule": self.name, "status": "Available"}
        if seat_class:
            filters["seat_class"] = seat_class
        return frappe.db.count("Seat Inventory", filters)
    
    def reserved_seats(self):
        """Count reserved seats"""
        return frappe.db.count("Seat Inventory", {
            "flight_schedule": self.name,
            "status": "Reserved"
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
            "status": "Reserved",
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
        
        seat.status = "Reserved"
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
        
        if seat.status != "Reserved":
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
        
        if seat.status not in ["Reserved", "Booked"]:
            return {"success": False, "message": f"Seat {seat_number} not reserved/booked"}
        
        seat.status = "Available"
        seat.hold_expiry = None
        seat.booking_reference = None
        seat.save()
        frappe.db.commit()
        
        return {"success": True, "message": f"Seat {seat_number} cancelled"}