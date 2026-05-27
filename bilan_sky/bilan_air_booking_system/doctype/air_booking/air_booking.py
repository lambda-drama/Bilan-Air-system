# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

# import frappe
import frappe
from frappe.model.document import Document
from frappe.utils import flt, get_datetime, getdate, now, nowdate

class AirBooking(Document):
    def autoname(self):
        from frappe.model.naming import make_autoname

        self.name = make_autoname("BA-.#####")
        self.pnr = self.name

    def validate(self):
        if self.name:
            self.pnr = self.name

    # =========================================================
    # BEFORE SAVE VALIDATIONS
    # =========================================================

    def before_save(self):
        """Run validations before saving"""
        self.validate_booking_cutoff()
        self.validate_passengers()
        self.validate_seat_availability()
        self.calculate_total_fare()

    def _save_status_updates(self):
        # Status transitions should not be blocked by seat validation rules.
        self.flags.ignore_validate = True
        self.save()
        self.flags.ignore_validate = False
    
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
        if get_datetime(now()) > get_datetime(cutoff_datetime):
            frappe.throw(f"Cannot book. Booking cutoff was {cutoff_datetime}")
    
    def validate_passengers(self):
        if not self.passengers:
            frappe.throw("Add at least one passenger.")

        for idx, row in enumerate(self.passengers, start=1):
            if not (row.passenger_name or "").strip():
                frappe.throw(f"Passenger name is required for traveler {idx}.")

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
            if not passenger.seat_number:
                continue

            # Get base fare (use override if exists)
            base_fare = flight.base_fare_override or route.base_fare
            
            # Apply seat class multiplier
            seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
            seat_class = frappe.get_doc("Seat Class", seat.seat_class)
            class_multiplier = seat_class.price_multiplier
            
            # Apply passenger type discount
            passenger_type = self._get_passenger_type(passenger)
            if passenger_type == "Infant":
                passenger_multiplier = settings.infant_fare_percentage / 100
            elif passenger_type == "Child":
                passenger_multiplier = settings.child_fare_percentage / 100
            else:
                passenger_multiplier = 1.0
            
            # Apply fare rule (days before departure)
            from frappe.utils import date_diff
            days_before = date_diff(flight.departure_date, getdate(now()))
            
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
    
    def generate_ticket_numbers(self, show_message: bool = False) -> list[str]:
        """Generate ticket numbers for all passengers: {PNR}-01, {PNR}-02, ..."""
        if not self.passengers:
            frappe.throw("Add at least one passenger before generating ticket numbers.")

        pnr = self.pnr or self.name
        tickets = []

        for idx, passenger in enumerate(self.passengers, start=1):
            ticket_number = f"{pnr}-{idx:02d}"
            passenger.ticket_number = ticket_number
            tickets.append(ticket_number)

        if show_message:
            frappe.msgprint(f"Generated {len(tickets)} ticket number(s)")

        return tickets
    
    # =========================================================
    # AFTER SAVE ACTIONS
    # =========================================================
    
    def on_update(self):
        """Run after save"""
        if self.flags.get("skip_auto_confirm"):
            return
        if self.payment_status == "Paid" and self.booking_status == "Reserved":
            self.confirm_booking()
    
    def confirm_booking(self):
        """Confirm booking after payment"""
        
        # Generate ticket numbers if not exist
        need_tickets = any([not p.ticket_number for p in self.passengers])
        if need_tickets:
            self.generate_ticket_numbers(show_message=False)
        
        # Confirm each seat
        for passenger in self.passengers:
            seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
            if seat.status in ("Hold", "Reserved") and seat.booking_reference == self.name:
                seat.status = "Booked"
                seat.hold_expiry = None
                seat.price_at_booking = passenger.fare_paid
                seat.save()
        
        # Update booking status
        self.booking_status = "Paid"
        self._save_status_updates()
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
        self._save_status_updates()
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
        
        # Keep seat as Booked at check-in stage.
        seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
        if seat.status not in ("Booked", "Hold", "Reserved"):
            frappe.throw(f"Seat {seat.seat_number} cannot be checked in from status {seat.status}")
        seat.status = "Booked"
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
                "passenger_name": passenger.passenger_name,
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
        all_checked = all([p.check_in_status in ("Checked In", "Boarded") for p in self.passengers])
        if all_checked:
            self.booking_status = "Checked In"
        
        self._save_status_updates()
        frappe.db.commit()
        
        return {"success": True, "message": f"Passenger {passenger_index+1} checked in"}
    
    def board_passenger(self, passenger_index):
        """Mark passenger as boarded"""
        
        if passenger_index >= len(self.passengers):
            frappe.throw("Invalid passenger index")
        
        passenger = self.passengers[passenger_index]
        if passenger.check_in_status == "Not Checked In":
            frappe.throw("Passenger must be checked in before boarding.")
        passenger.check_in_status = "Boarded"

        seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
        seat.status = "Occupied"
        seat.save()
        
        # Check if all passengers boarded
        all_boarded = all([p.check_in_status == "Boarded" for p in self.passengers])
        if all_boarded:
            self.booking_status = "Boarded"
        
        self._save_status_updates()
        frappe.db.commit()
        
        return {"success": True, "message": f"Passenger {passenger_index+1} boarded"}

    def check_in_all_passengers(self):
        for idx, passenger in enumerate(self.passengers):
            if passenger.check_in_status == "Not Checked In":
                self.check_in_passenger(idx)
        return {"success": True, "message": "All passengers checked in."}

    def board_all_passengers(self):
        for idx, passenger in enumerate(self.passengers):
            if passenger.check_in_status == "Checked In":
                self.board_passenger(idx)
        return {"success": True, "message": "All checked-in passengers boarded."}

    def mark_arrived(self):
        if self.booking_status != "Boarded":
            frappe.throw("Booking can be marked Arrived only after boarding.")
        self.booking_status = "Arrived"
        self._save_status_updates()
        frappe.db.commit()
        return {"success": True, "message": f"Booking {self.name} marked as Arrived."}

    # =========================================================
    # BILLING
    # =========================================================

    def _get_passenger_type(self, row) -> str:
        if row.passenger:
            return frappe.db.get_value("Passenger", row.passenger, "passenger_type") or row.passenger_type or "Adult"
        return row.passenger_type or "Adult"

    def _validate_billing_setup(self):
        if not (self.payer_name or "").strip():
            frappe.throw("Payer Full Name is required to create a Sales Invoice.")

        settings = frappe.get_single("BA Settings")
        if not settings.fare_item:
            frappe.throw("Set Fare Item in BA Settings before creating invoice.")
        if not settings.baggage_fee:
            frappe.throw("Set Baggage Fee item in BA Settings before creating invoice.")
        return settings

    def _get_main_fare_invoice(self):
        for row in self.invoices or []:
            if not row.invoice:
                continue
            if (row.invoice_type or "Main Fare") != "Main Fare":
                continue
            if frappe.db.exists("Sales Invoice", row.invoice):
                return row.invoice
        return None

    def create_sales_invoice(self, submit=False):
        existing = self._get_main_fare_invoice()
        if existing:
            if submit:
                self._submit_sales_invoice(existing)
            return {"success": True, "invoice": existing, "created": False}

        settings = self._validate_billing_setup()
        customer = self.customer_link or self._get_or_create_customer()
        company = frappe.db.get_single_value("Global Defaults", "default_company")
        if not company:
            frappe.throw("Set Default Company in Global Defaults.")

        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.company = company
        invoice.posting_date = nowdate()
        invoice.due_date = nowdate()
        invoice.currency = settings.default_currency or None
        invoice.remarks = f"Air Booking {self.name}"

        fare_amount = flt(self.total_fare)
        if fare_amount > 0:
            invoice.append(
                "items",
                {
                    "item_code": settings.fare_item,
                    "qty": 1,
                    "rate": fare_amount,
                    "description": f"Main Fare for booking {self.name}",
                },
            )

        baggage_amount = self._get_baggage_total_fee()
        if baggage_amount > 0:
            invoice.append(
                "items",
                {
                    "item_code": settings.baggage_fee,
                    "qty": 1,
                    "rate": baggage_amount,
                    "description": f"Excess baggage charges for booking {self.name}",
                },
            )

        if not invoice.items:
            frappe.throw("No billable amount found (fare/baggage).")

        invoice.insert(ignore_permissions=True)
        if submit:
            invoice.submit()

        self.append("invoices", {"invoice": invoice.name, "invoice_type": "Main Fare"})
        if not self.customer_link:
            self.customer_link = customer
        self.flags.ignore_validate = True
        self.save()
        self.flags.ignore_validate = False
        frappe.db.commit()

        return {"success": True, "invoice": invoice.name, "created": True}

    def _submit_sales_invoice(self, invoice_name):
        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        if invoice.docstatus == 0:
            invoice.submit()

    def confirm_payment_and_invoice(self):
        """Mark paid, create/submit Sales Invoice and Payment Entry, confirm booking."""
        if self.booking_status == "Cancelled":
            frappe.throw("Cannot record payment on a cancelled booking.")
        if self.payment_status == "Refunded":
            frappe.throw("Cannot record payment on a refunded booking.")
        if not self.payment_method:
            frappe.throw("Select a Payment Method before confirming payment.")

        self._validate_billing_setup()

        invoice_name = self._get_main_fare_invoice()
        if not invoice_name:
            result = self.create_sales_invoice(submit=True)
            invoice_name = result["invoice"]
        else:
            self._submit_sales_invoice(invoice_name)

        payment_entry_name = self.payment_entry
        if payment_entry_name and frappe.db.exists("Payment Entry", payment_entry_name):
            if frappe.db.get_value("Payment Entry", payment_entry_name, "docstatus") == 0:
                frappe.get_doc("Payment Entry", payment_entry_name).submit()
        else:
            from bilan_sky.bilan_air_booking_system.utils.billing import (
                create_and_submit_payment_entry,
            )

            payment_entry_name = create_and_submit_payment_entry(
                invoice_name,
                mode_of_payment=self.payment_method,
                reference_no=self.name,
            )
            self.payment_entry = payment_entry_name

        self.payment_status = "Paid"

        if self.booking_status == "Reserved":
            self.flags.skip_auto_confirm = True
            self.confirm_booking()
            self.flags.skip_auto_confirm = False
        else:
            self.flags.ignore_validate = True
            self.save()
            self.flags.ignore_validate = False

        frappe.db.commit()

        return {
            "success": True,
            "invoice": invoice_name,
            "payment_entry": payment_entry_name,
            "booking_status": self.booking_status,
            "payment_status": self.payment_status,
        }

    def _get_or_create_customer(self):
        from bilan_sky.bilan_air_booking_system.utils.customer_group import (
            ensure_passenger_customer_group,
        )

        payer_name = (self.payer_name or "").strip()
        existing = frappe.db.get_value("Customer", {"customer_name": payer_name}, "name")
        if existing:
            return existing

        customer_group = ensure_passenger_customer_group()

        customer = frappe.get_doc(
            {
                "doctype": "Customer",
                "customer_name": payer_name,
                "customer_type": "Individual",
                "customer_group": customer_group,
                "territory": "All Territories",
            }
        )
        if self.payer_email:
            customer.email_id = self.payer_email
        if self.payer_phone:
            customer.mobile_no = self.payer_phone
        customer.insert(ignore_permissions=True)
        return customer.name

    def _get_baggage_total_fee(self):
        total = 0.0
        for row in self.baggage_tracking_numbers or []:
            if not row.baggage_tracking:
                continue
            total += flt(
                frappe.db.get_value("Baggage Tracking", row.baggage_tracking, "baggage_fee") or 0
            )
        return flt(total)