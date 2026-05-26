# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

# import frappe
import frappe
from frappe.model.document import Document
from frappe.utils import now, get_datetime

class AirBooking(Document):
    
    # =========================================================
    # BEFORE SAVE VALIDATIONS
    # =========================================================
    
    def before_save(self):
        """Run validations before saving"""
        self.validate_booking_cutoff()
        self.validate_seat_availability()
        self.calculate_total_fare()
    
    def validate_booking_cutoff(self):
        """Prevent booking if within cutoff time"""
        
        if self.booking_status == "Paid":
            return  # Already paid, skip cutoff check
        
        # Get cutoff from settings
        settings = frappe.get_single("BA Settings")
        cutoff_hours = settings.booking_cutoff_hours
        
        # Get flight departure time
        flight = frappe.get_doc("Flight Schedule", self.flight_schedule)
        departure_datetime = get_datetime(f"{flight.departure_date} {flight.departure_time}")
        
        # Calculate cutoff datetime
        from frappe.utils import add_to_date
        cutoff_datetime = add_to_date(departure_datetime, hours=-cutoff_hours)
        
        # Check if current time is past cutoff
        if now() > cutoff_datetime:
            frappe.throw(f"Cannot book. Booking cutoff was {cutoff_datetime}")
    
    def validate_seat_availability(self):
        """Check if selected seats are still available"""
        
        for passenger in self.passengers:
            if passenger.seat_number:
                seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
                
                # For new booking, seat must be Available
                if self.is_new() and seat.status != "Available":
                    frappe.throw(f"Seat {seat.seat_number} is no longer available")
                
                # For existing booking, seat must match
                if not self.is_new() and seat.booking_reference != self.name:
                    frappe.throw(f"Seat {seat.seat_number} belongs to another booking")
    
    # =========================================================
    # FARE CALCULATION
    # =========================================================
    
    def calculate_total_fare(self):
        """Calculate fare for each passenger and total"""
        
        if not self.flight_schedule:
            return
        
        flight = frappe.get_doc("Flight Schedule", self.flight_schedule)
        route = frappe.get_doc("Flight Route", flight.route)
        
        # Get settings for child/infant percentages
        settings = frappe.get_single("BA Settings")
        
        # Calculate fare per passenger
        for passenger in self.passengers:
            passenger_doc = frappe.get_doc("Passenger", passenger.passenger)
            
            # Get base fare (use override if exists)
            base_fare = flight.base_fare_override or route.base_fare
            
            # Apply seat class multiplier
            seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
            seat_class = frappe.get_doc("Seat Class", seat.seat_class)
            class_multiplier = seat_class.price_multiplier
            
            # Apply passenger type discount
            passenger_type = passenger_doc.passenger_type
            if passenger_type == "Infant":
                passenger_multiplier = settings.infant_fare_percentage / 100
            elif passenger_type == "Child":
                passenger_multiplier = settings.child_fare_percentage / 100
            else:
                passenger_multiplier = 1.0
            
            # Apply fare rule (days before departure)
            from frappe.utils import date_diff
            days_before = date_diff(flight.departure_date, now())
            
            fare_rule = frappe.get_all("Fare Rule", filters={
                "route": flight.route,
                "days_before_departure": [">=", days_before]
            }, order_by="days_before_departure asc", limit=1)
            
            fare_multiplier = 1.0
            if fare_rule:
                rule = frappe.get_doc("Fare Rule", fare_rule[0].name)
                fare_multiplier = 1 + (rule.price_increase_percentage / 100)
            
            # Calculate final fare
            final_fare = base_fare * class_multiplier * passenger_multiplier * fare_multiplier
            passenger.fare_paid = round(final_fare, 2)
        
        # Calculate total
        self.total_fare = sum([p.fare_paid for p in self.passengers])
    
    # =========================================================
    # TICKET NUMBERS
    # =========================================================
    
    def generate_ticket_numbers(self):
        """Generate ticket numbers for all passengers"""
        
        for idx, passenger in enumerate(self.passengers, start=1):
            ticket_number = f"{self.name}-{idx:02d}"
            passenger.ticket_number = ticket_number
        
        frappe.msgprint(f"Generated {len(self.passengers)} ticket numbers")
    
    # =========================================================
    # AFTER SAVE ACTIONS
    # =========================================================
    
    def on_update(self):
        """Run after save"""
        if self.payment_status == "Paid" and self.booking_status == "Reserved":
            self.confirm_booking()
    
    def confirm_booking(self):
        """Confirm booking after payment"""
        
        # Generate ticket numbers if not exist
        need_tickets = any([not p.ticket_number for p in self.passengers])
        if need_tickets:
            self.generate_ticket_numbers()
        
        # Confirm each seat
        for passenger in self.passengers:
            seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
            if seat.status == "Reserved" and seat.booking_reference == self.name:
                seat.status = "Booked"
                seat.hold_expiry = None
                seat.price_at_booking = passenger.fare_paid
                seat.save()
        
        # Update booking status
        self.booking_status = "Paid"
        frappe.db.commit()
        
        frappe.msgprint(f"Booking {self.name} confirmed. PNR: {self.name}")
    
    def cancel_booking(self):
        """Cancel entire booking and release seats"""
        
        for passenger in self.passengers:
            if passenger.seat_number:
                seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
                if seat.booking_reference == self.name:
                    seat.status = "Available"
                    seat.hold_expiry = None
                    seat.booking_reference = None
                    seat.save()
        
        self.booking_status = "Cancelled"
        frappe.db.commit()
        
        frappe.msgprint(f"Booking {self.name} cancelled")
    
    # =========================================================
    # CHECK-IN METHODS
    # =========================================================
    
    def check_in_passenger(self, passenger_index, baggage_weight=0):
        """Check in a specific passenger"""
        
        if passenger_index >= len(self.passengers):
            frappe.throw("Invalid passenger index")
        
        passenger = self.passengers[passenger_index]
        
        # Update passenger check-in status
        passenger.check_in_status = "Checked In"
        
        # Update seat status to Occupied
        seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
        seat.status = "Occupied"
        seat.save()
        
        # Create baggage record if weight > 0
        if baggage_weight > 0:
            settings = frappe.get_single("BA Settings")
            is_excess = baggage_weight > settings.max_baggage_kg
            fee = 0
            if is_excess:
                excess = baggage_weight - settings.max_baggage_kg
                fee = excess * settings.excess_baggage_fee
            
            baggage = frappe.get_doc({
                "doctype": "Baggage Tracking",
                "air_booking": self.name,
                "passenger": passenger.passenger,
                "flight_schedule": self.flight_schedule,
                "weight_kg": baggage_weight,
                "baggage_fee": fee,
                "is_excess": is_excess,
                "status": "Checked In"
            })
            baggage.insert()
            
            # Link baggage to booking
            self.append("baggage_tracking_numbers", {
                "baggage_tracking": baggage.name
            })
        
        # Check if all passengers checked in
        all_checked = all([p.check_in_status == "Checked In" for p in self.passengers])
        if all_checked:
            self.booking_status = "Checked In"
        
        frappe.db.commit()
        
        return {"success": True, "message": f"Passenger {passenger_index+1} checked in"}
    
    def board_passenger(self, passenger_index):
        """Mark passenger as boarded"""
        
        if passenger_index >= len(self.passengers):
            frappe.throw("Invalid passenger index")
        
        passenger = self.passengers[passenger_index]
        passenger.check_in_status = "Boarded"
        
        # Check if all passengers boarded
        all_boarded = all([p.check_in_status == "Boarded" for p in self.passengers])
        if all_boarded:
            self.booking_status = "Boarded"
        
        frappe.db.commit()
        
        return {"success": True, "message": f"Passenger {passenger_index+1} boarded"}