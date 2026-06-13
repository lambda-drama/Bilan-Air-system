# Copyright (c) 2026, NF and contributors
# For license information, please see license.txt

# import frappe
import frappe
from frappe.model.document import Document
from frappe.utils import add_days, flt, get_datetime, getdate, now, nowdate

from bilan_sky.bilan_air_booking_system.utils.reservation_status import (
	BOOKED,
	CONFIRM,
	FLIGHT_TAKEN,
	VOID,
)

class AirBooking(Document):
    def autoname(self):
        from frappe.model.naming import make_autoname

        if not self.name:
            from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting

            series = (get_ba_setting("reservation_naming_series", None) or "RES-.#####").strip()
            self.name = make_autoname(series)
        self._sync_reservation_ref()

    def before_insert(self):
        self._sync_reservation_ref()

    def validate(self):
        self._sync_reservation_ref()
        self._apply_default_journey_airports()
        if self.pnr and self.reservation_status not in (CONFIRM, FLIGHT_TAKEN):
            frappe.throw("PNR can only be set on a confirmed reservation.")

    def _sync_reservation_ref(self):
        """Mirror document name; assigned on insert from reservation naming series."""
        if self.name:
            self.reservation_ref = self.name

    def _apply_default_journey_airports(self):
        """Fill boarding/deboarding from the flight schedule when not set."""
        if not self.flight_schedule:
            return
        from bilan_sky.bilan_air_booking_system.utils.flight_segments import default_journey_airports

        defaults = default_journey_airports(self.flight_schedule)
        if not self.boarding_airport and defaults.get("boarding_airport"):
            self.boarding_airport = defaults["boarding_airport"]
        if not self.deboarding_airport and defaults.get("deboarding_airport"):
            self.deboarding_airport = defaults["deboarding_airport"]

    # =========================================================
    # BEFORE SAVE VALIDATIONS
    # =========================================================

    def before_save(self):
        """Run validations before saving"""
        self.validate_schedule_bookable()
        self.validate_booking_cutoff()
        self.validate_passengers()
        self.validate_seat_availability()
        self.calculate_total_fare()

    def on_trash(self):
        """Release linked seats before delete link check runs."""
        self._release_all_seats()

    def _release_all_seats(self):
        from bilan_sky.bilan_air_booking_system.utils.seat_booking import release_seat_for_booking

        for passenger in self.passengers or []:
            if not passenger.seat_number:
                continue
            release_seat_for_booking(passenger.seat_number, self.name)

    def _save_status_updates(self):
        # Status transitions should not be blocked by seat validation rules.
        self.flags.ignore_validate = True
        try:
            if self.docstatus == 1:
                self._update_after_submit()
            else:
                self.save()
        finally:
            self.flags.ignore_validate = False

    def _update_after_submit(self):
        """Persist allow_on_submit fields on submitted reservations without full save()."""
        from frappe.model.meta import get_meta

        table_fieldtypes = ("Table", "Table MultiSelect")
        allowed_parent = {
            df.fieldname
            for df in get_meta(self.doctype).fields
            if df.get("allow_on_submit") and df.fieldtype not in table_fieldtypes
        }
        if allowed_parent:
            parent_values = {fieldname: self.get(fieldname) for fieldname in allowed_parent}
            frappe.db.set_value(self.doctype, self.name, parent_values, update_modified=True)

        child_meta = {}
        for child in self.get_all_children():
            if child.doctype not in child_meta:
                child_meta[child.doctype] = {
                    df.fieldname
                    for df in get_meta(child.doctype).fields
                    if df.get("allow_on_submit")
                }
            allowed_child = child_meta[child.doctype]
            if not child.name or not allowed_child:
                continue
            row_values = {fieldname: child.get(fieldname) for fieldname in allowed_child}
            frappe.db.set_value(child.doctype, child.name, row_values, update_modified=True)
    
    def validate_booking_cutoff(self):
        """Prevent booking if within cutoff time"""
        if self.reservation_status == CONFIRM:
            return  # Already paid, skip cutoff check
        if not self.flight_schedule:
            return

        settings = frappe.get_single("BA Settings")
        cutoff_hours = settings.booking_cutoff_hours
        flight = frappe.get_doc("Flight Schedule", self.flight_schedule)
        departure_datetime = get_datetime(f"{flight.departure_date} {flight.departure_time}")

        from frappe.utils import add_to_date
        cutoff_datetime = add_to_date(departure_datetime, hours=-cutoff_hours)

        if get_datetime(now()) > get_datetime(cutoff_datetime):
            frappe.throw(f"Cannot book. Booking cutoff was {cutoff_datetime}")

    def validate_schedule_bookable(self):
        from bilan_sky.bilan_air_booking_system.utils.flight_schedule_booking import (
            assert_schedule_active_for_booking,
        )

        if self.flight_schedule:
            assert_schedule_active_for_booking(self.flight_schedule)
    
    def validate_passengers(self):
        if not self.passengers:
            frappe.throw("Add at least one passenger.")

        from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import is_seat_selection_enabled

        for idx, row in enumerate(self.passengers, start=1):
            if not (row.passenger_name or "").strip():
                frappe.throw(f"Passenger name is required for traveler {idx}.")
            if is_seat_selection_enabled() and not (row.seat_number or "").strip():
                frappe.throw(f"Select a seat for traveler {idx} (seat selection is required).")

    def validate_seat_availability(self):
        """Check if selected seats are still available for this flight and booking."""
        from bilan_sky.bilan_air_booking_system.doctype.seat_inventory.seat_inventory import (
            prepare_seat_for_new_booking,
        )

        from bilan_sky.bilan_air_booking_system.utils.seat_inventory_resolve import (
            resolve_seat_inventory_ref,
        )

        for passenger in self.passengers:
            if not passenger.seat_number:
                continue

            seat_name = resolve_seat_inventory_ref(passenger.seat_number, self.flight_schedule)
            if not seat_name:
                frappe.throw(
                    f"Seat {passenger.seat_number} was not found on flight {self.flight_schedule}. "
                    "Choose a seat from Seat Inventory for this schedule."
                )
            passenger.seat_number = seat_name

            prepare_seat_for_new_booking(seat_name, self.name)
            seat = frappe.get_doc("Seat Inventory", seat_name)

            if seat.flight_schedule != self.flight_schedule:
                frappe.throw(
                    f"Seat {seat.seat_number} is not on flight {self.flight_schedule}"
                )

            # Already linked to this booking (e.g. Hold after reserve on a follow-up save)
            if seat.booking_reference == self.name:
                continue

            if seat.booking_reference:
                other = seat.booking_reference
                frappe.throw(
                    f"Seat {seat.seat_number} is held by booking {other}. "
                    f"Pay or cancel that booking first, or choose another seat."
                )

            if seat.status != "Available":
                frappe.throw(
                    f"Seat {seat.seat_number} is no longer available ({seat.status})"
                )
    
    def _cabin_class_multiplier(self, cabin_class_name=None, fare_class_name=None):
        from bilan_sky.bilan_air_booking_system.utils.seat_class_utils import (
            fare_multiplier_for_code,
            multiplier_for_cabin_name,
            resolve_seat_class_ref,
        )

        if fare_class_name:
            return fare_multiplier_for_code(
                frappe.db.get_value("Seat Class", fare_class_name, "class_name")
            )
        if cabin_class_name:
            seat_class_name = resolve_seat_class_ref(cabin_class_name)
            if seat_class_name:
                return flt(frappe.db.get_value("Seat Class", seat_class_name, "price_multiplier")) or 1.0
            return multiplier_for_cabin_name(cabin_class_name)
        return 1.0

    # =========================================================
    # FARE CALCULATION
    # =========================================================
    
    def calculate_total_fare(self):
        """Calculate fare for each passenger and total"""
        
        if not self.flight_schedule:
            return
        
        flight = frappe.get_doc("Flight Schedule", self.flight_schedule)
        route = frappe.get_doc("Flight Route", flight.route)
        
        from bilan_sky.bilan_air_booking_system.utils.fare_pricing import (
            base_fare_for_passenger,
            fare_rule_multiplier,
        )

        fare_multiplier = fare_rule_multiplier(flight.route, flight.departure_date)

        # Calculate fare per passenger
        from bilan_sky.bilan_air_booking_system.utils.seat_inventory_resolve import (
            resolve_seat_inventory_ref,
        )

        for passenger in self.passengers:
            base_fare = base_fare_for_passenger(
                flight,
                route,
                self._get_passenger_type(passenger),
            )
            class_multiplier = 1.0

            if passenger.seat_number:
                seat_name = resolve_seat_inventory_ref(passenger.seat_number, self.flight_schedule)
                if seat_name:
                    passenger.seat_number = seat_name
                    if self.fare_class:
                        class_multiplier = self._cabin_class_multiplier(fare_class_name=self.fare_class)
                    else:
                        seat = frappe.get_doc("Seat Inventory", seat_name)
                        seat_class = frappe.get_doc("Seat Class", seat.seat_class)
                        class_multiplier = flt(seat_class.price_multiplier) or 1.0
            elif self.fare_class:
                class_multiplier = self._cabin_class_multiplier(fare_class_name=self.fare_class)
            elif self.cabin_class:
                class_multiplier = self._cabin_class_multiplier(cabin_class_name=self.cabin_class)

            passenger.fare_paid = round(base_fare * class_multiplier * fare_multiplier, 2)

        # Calculate total
        self.total_fare = sum([flt(p.fare_paid) for p in self.passengers])

        if self.passengers and flt(self.total_fare) <= 0:
            has_pricing_context = any((p.seat_number or "").strip() for p in self.passengers) or bool(
                (self.cabin_class or "").strip()
            )
            if has_pricing_context:
                frappe.throw(
                    "Total fare is zero. Set base fares on the route (or schedule overrides) and cabin/seat class multipliers."
                )
    
    # =========================================================
    # TICKET NUMBERS
    # =========================================================
    
    def generate_ticket_numbers(self, show_message: bool = False) -> list[str]:
        """Generate ticket numbers for all passengers: {PNR}-01, {PNR}-02, ..."""
        if not self.passengers:
            frappe.throw("Add at least one passenger before generating ticket numbers.")

        if not (self.pnr or "").strip():
            frappe.throw(
                "Confirm the reservation (paid) to issue a PNR before generating ticket numbers."
            )
        pnr = self.pnr
        tickets = []

        for idx, passenger in enumerate(self.passengers, start=1):
            ticket_number = f"{pnr}-{idx:02d}"
            passenger.ticket_number = ticket_number
            tickets.append(ticket_number)

        if show_message:
            frappe.msgprint(f"Generated {len(tickets)} ticket number(s)")

        return tickets
    
    # =========================================================
    # PNR & CONFIRMATION
    # =========================================================

    def _pnr_naming_series(self):
        from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting

        return (get_ba_setting("pnr_naming_series", None) or "BA-.#####").strip()

    def assign_pnr(self):
        """Issue the customer-facing PNR (e.g. BA-00001) once payment or agent credit confirms the ticket."""
        if self.pnr:
            return self.pnr

        from frappe.model.naming import make_autoname

        self.pnr = make_autoname(self._pnr_naming_series())
        return self.pnr

    def get_public_reference(self):
        """PNR after confirmation; otherwise internal reservation reference."""
        return self.pnr or self.name

    def _validate_confirmation_eligibility(self, via_credit=False):
        if via_credit:
            self._validate_agent_credit_for_confirmation()
            return
        if self.payment_status != "Paid":
            frappe.throw(
                "Payment or approved agent credit is required before issuing a PNR and tickets."
            )

    def _validate_agent_credit_for_confirmation(self):
        from bilan_sky.bilan_air_booking_system.utils.booking_agent import (
            validate_credit_confirmation_for_booking,
        )

        return validate_credit_confirmation_for_booking(self)

    def _ensure_confirmable_fare_for_credit(self):
        """Block credit confirmation when no billable fare was calculated."""
        if flt(self.total_fare) > 0:
            return
        passengers = self.passengers or []
        if not passengers:
            frappe.throw("Add at least one passenger before confirming on credit.")
        from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import is_seat_selection_enabled

        if is_seat_selection_enabled():
            without_seat = [p.passenger_name or p.name for p in passengers if not p.seat_number]
            if without_seat:
                frappe.throw(
                    "Assign a seat to each passenger before confirming on credit. "
                    f"Missing seat for: {', '.join(without_seat)}"
                )
        frappe.throw(
            "Total fare is zero. Set base fares on the flight route (or schedule overrides) and save, then try again."
        )

    def confirm_booking(self, via_credit=False):
        """Confirm ticket: issue PNR + ticket numbers after payment or approved agent credit."""
        if self.reservation_status == VOID:
            frappe.throw("Cannot confirm a voided reservation.")
        if via_credit:
            from bilan_sky.bilan_air_booking_system.utils.flight_schedule_booking import (
                assert_credit_confirmation_allowed,
            )

            assert_credit_confirmation_allowed(self.flight_schedule)
        self.calculate_total_fare()
        if via_credit:
            self._ensure_confirmable_fare_for_credit()
        self._validate_confirmation_eligibility(via_credit=via_credit)
        if self.reservation_status == CONFIRM and self.pnr:
            return {"success": True, "pnr": self.pnr, "already_confirmed": True}

        credit_agent = None
        if via_credit:
            credit_agent = self._validate_agent_credit_for_confirmation()
            self.payment_status = "Paid"

        self.assign_pnr()

        need_tickets = any([not p.ticket_number for p in self.passengers])
        if need_tickets:
            self.generate_ticket_numbers(show_message=False)

        from bilan_sky.bilan_air_booking_system.utils.seat_booking import confirm_seat_for_booking

        for passenger in self.passengers:
            if not passenger.seat_number:
                continue
            confirm_seat_for_booking(passenger.seat_number, self.name)
            seat = frappe.get_doc("Seat Inventory", passenger.seat_number)
            if seat.booking_reference == self.name:
                seat.price_at_booking = passenger.fare_paid
                seat.save(ignore_permissions=True)

        self.reservation_status = CONFIRM
        if via_credit and credit_agent:
            self.confirmed_via = "Agent Credit"
            self.booking_agent = credit_agent.name
        elif not via_credit:
            self.confirmed_via = "Payment"

        self._save_status_updates()

        if via_credit and credit_agent:
            credit_agent.consume_credit(flt(self.total_fare))

        frappe.db.commit()

        frappe.msgprint(
            f"Reservation {self.name} confirmed. PNR: {self.pnr}",
            indicator="green",
        )
        return {"success": True, "pnr": self.pnr, "reservation_ref": self.name}
    
    def cancel_booking(self, reason_for_cancel=None):
        """Cancel entire booking and release seats"""
        reason = (reason_for_cancel or "").strip()
        if not reason:
            frappe.throw("Please provide a reason for cancellation.")

        self.reason_for_cancel = reason
        self._release_all_seats()
        
        self.reservation_status = VOID
        self._save_status_updates()
        frappe.db.commit()
        
        frappe.msgprint(f"Booking {self.name} cancelled")
    
    # =========================================================
    # CHECK-IN METHODS
    # =========================================================
    
    def check_in_passenger(self, passenger_index, baggage_weight=0):
        """Check in a specific passenger"""
        if self.payment_status != "Paid":
            frappe.throw("Booking must be paid before check-in.")
        if self.reservation_status == VOID:
            frappe.throw("Cannot check in a voided reservation.")

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
            from bilan_sky.bilan_air_booking_system.utils.baggage_allowance import calculate_excess_fee

            excess_result = calculate_excess_fee(
                baggage_weight,
                seat_inventory_name=passenger.seat_number,
            )
            is_excess = excess_result["is_excess"]
            fee = excess_result["fee"]
            
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
        
        if self.reservation_status not in (CONFIRM, FLIGHT_TAKEN):
            frappe.throw("Reservation must be confirmed (paid with PNR) before check-in.")

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
        
        if self.reservation_status not in (CONFIRM, FLIGHT_TAKEN):
            frappe.throw("Reservation must be confirmed before boarding.")

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

    def mark_flight_taken(self):
        """Manually mark reservation as Flight Taken (e.g. when departure has commenced)."""
        if self.reservation_status == VOID:
            frappe.throw("Cannot update a voided reservation.")
        if self.reservation_status == BOOKED:
            frappe.throw("Confirm the reservation and issue a PNR before marking flight taken.")
        if self.reservation_status != CONFIRM:
            return {
                "success": True,
                "message": f"Reservation {self.get_public_reference()} is already {self.reservation_status}.",
            }

        self.reservation_status = FLIGHT_TAKEN
        self._save_status_updates()
        frappe.db.commit()
        return {
            "success": True,
            "message": f"Reservation {self.get_public_reference()} marked as Flight Taken.",
        }

    def mark_arrived(self):
        """Backward-compatible alias for mark_flight_taken."""
        return self.mark_flight_taken()

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

    def _invoice_is_accessible(self, invoice_name):
        if not invoice_name:
            return False
        from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

        if is_remote_accounting_enabled():
            from bilan_sky.bilan_air_booking_system.utils.remote_erp import get_remote_client

            return get_remote_client().doc_exists("Sales Invoice", invoice_name)
        return bool(frappe.db.exists("Sales Invoice", invoice_name))

    def _append_invoice_link(self, invoice_name, invoice_type="Main Fare", invoice_number=None):
        self.append(
            "invoices",
            {
                "invoice": invoice_name,
                "invoice_type": invoice_type,
                "invoice_number": invoice_number or invoice_name,
            },
        )

    def _get_main_fare_invoice(self):
        for row in self.invoices or []:
            if not row.invoice:
                continue
            if (row.invoice_type or "Main Fare") != "Main Fare":
                continue
            if self._invoice_is_accessible(row.invoice):
                return row.invoice
        return None

    def process_refund(self, refund_type="full", refund_amount=None):
        """Create a return invoice on the accounting site (full or partial credit note)."""
        if self.payment_status != "Paid":
            return None

        main_invoice = self._get_main_fare_invoice()
        if not main_invoice:
            frappe.throw(f"No sales invoice found to refund for booking {self.name}.")

        from bilan_sky.bilan_air_booking_system.utils.billing import (
            create_return_sales_invoice,
            get_sales_invoice_grand_total,
        )

        refund_type = (refund_type or "full").strip().lower()
        partial_amount = None
        if refund_type == "partial":
            partial_amount = flt(refund_amount)
            if partial_amount <= 0:
                frappe.throw("Enter a refund amount greater than zero.")
            invoice_total = get_sales_invoice_grand_total(main_invoice)
            if partial_amount > invoice_total:
                frappe.throw(
                    f"Refund amount cannot exceed invoice total {invoice_total}."
                )
        elif refund_type != "full":
            frappe.throw("Refund type must be full or partial.")

        return_name, return_number = create_return_sales_invoice(
            main_invoice,
            refund_amount=partial_amount,
            submit=True,
        )
        from bilan_sky.bilan_air_booking_system.utils.billing import create_refund_payment_entry

        refund_payment_entry = create_refund_payment_entry(
            return_name,
            mode_of_payment=self.payment_method,
            reference_no=self.get_public_reference(),
        )
        self._append_invoice_link(return_name, "Return", return_number)
        self.payment_status = "Refunded"
        self.flags.ignore_validate = True
        self.save()
        self.flags.ignore_validate = False
        frappe.db.commit()
        return {
            "return_invoice": return_name,
            "return_invoice_number": return_number,
            "refund_payment_entry": refund_payment_entry,
            "refund_type": refund_type,
            "refund_amount": partial_amount,
        }

    def create_sales_invoice(self, submit=False):
        from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

        existing = self._get_main_fare_invoice()
        if existing:
            if submit:
                self._submit_sales_invoice(existing)
            return {"success": True, "invoice": existing, "created": False}

        settings = self._validate_billing_setup()

        if is_remote_accounting_enabled():
            from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
                create_remote_sales_invoice,
            )

            invoice_name = create_remote_sales_invoice(self, submit=submit)
            from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
                get_remote_client,
                remote_invoice_number,
            )

            invoice_number = remote_invoice_number(get_remote_client(), invoice_name)
            self._append_invoice_link(invoice_name, "Main Fare", invoice_number)
            self.flags.ignore_validate = True
            self.save()
            self.flags.ignore_validate = False
            frappe.db.commit()
            return {"success": True, "invoice": invoice_name, "created": True}

        customer = self.customer_link or self._get_or_create_customer()
        company = frappe.db.get_single_value("Global Defaults", "default_company")
        if not company:
            frappe.throw("Set Default Company in Global Defaults.")

        from bilan_sky.bilan_air_booking_system.utils.billing import (
            apply_sales_invoice_defaults_from_settings,
            sales_invoice_item_row,
        )

        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = customer
        invoice.company = company
        invoice.posting_date = nowdate()
        invoice.due_date = add_days(invoice.posting_date, 7)
        invoice.currency = settings.default_currency or None
        invoice.remarks = f"Air Booking {self.name}"
        apply_sales_invoice_defaults_from_settings(invoice, settings)

        fare_amount = flt(self.total_fare)
        if fare_amount > 0:
            invoice.append(
                "items",
                sales_invoice_item_row(
                    settings.fare_item,
                    fare_amount,
                    f"Main Fare for booking {self.name}",
                    settings,
                ),
            )

        baggage_amount = self._get_baggage_total_fee()
        if baggage_amount > 0:
            invoice.append(
                "items",
                sales_invoice_item_row(
                    settings.baggage_fee,
                    baggage_amount,
                    f"Excess baggage charges for booking {self.name}",
                    settings,
                ),
            )

        if not invoice.items:
            frappe.throw("No billable amount found (fare/baggage).")

        invoice.insert(ignore_permissions=True)
        if submit:
            invoice.submit()

        self._append_invoice_link(invoice.name, "Main Fare", invoice.name)
        if not self.customer_link:
            self.customer_link = customer
        self.flags.ignore_validate = True
        self.save()
        self.flags.ignore_validate = False
        frappe.db.commit()

        return {
            "success": True,
            "invoice": invoice.name,
            "invoice_number": invoice.name,
            "created": True,
        }

    def _submit_sales_invoice(self, invoice_name):
        from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

        if is_remote_accounting_enabled():
            from bilan_sky.bilan_air_booking_system.utils.remote_billing import (
                submit_remote_sales_invoice,
            )

            submit_remote_sales_invoice(invoice_name)
            return

        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        if invoice.docstatus == 0:
            invoice.submit()

    def _ensure_main_fare_invoice_and_payment(
        self,
        payment_method=None,
        paid_account=None,
        reference_no=None,
    ):
        """Create or submit the main fare Sales Invoice and Payment Entry when billing is configured."""
        from bilan_sky.bilan_air_booking_system.utils.ba_settings_utils import get_ba_setting
        from bilan_sky.bilan_air_booking_system.utils.remote_erp import is_remote_accounting_enabled

        if payment_method:
            self.payment_method = payment_method
        if not self.payment_method:
            self.payment_method = get_ba_setting("default_mode_of_payment", "Cash")

        self._validate_billing_setup()

        invoice_name = self._get_main_fare_invoice()
        if not invoice_name:
            result = self.create_sales_invoice(submit=True)
            invoice_name = result["invoice"]
        else:
            self._submit_sales_invoice(invoice_name)

        payment_entry_name = self.payment_entry
        pe_exists = False
        if payment_entry_name:
            if is_remote_accounting_enabled():
                from bilan_sky.bilan_air_booking_system.utils.remote_erp import get_remote_client

                pe_exists = get_remote_client().doc_exists("Payment Entry", payment_entry_name)
            else:
                pe_exists = bool(frappe.db.exists("Payment Entry", payment_entry_name))

        if pe_exists:
            if is_remote_accounting_enabled():
                from bilan_sky.bilan_air_booking_system.utils.remote_erp import get_remote_client

                pe = get_remote_client().get_doc("Payment Entry", payment_entry_name)
                if pe.get("docstatus") == 0:
                    get_remote_client().submit("Payment Entry", payment_entry_name)
            elif frappe.db.get_value("Payment Entry", payment_entry_name, "docstatus") == 0:
                frappe.get_doc("Payment Entry", payment_entry_name).submit()
        else:
            from bilan_sky.bilan_air_booking_system.utils.billing import (
                create_and_submit_payment_entry,
            )

            payment_entry_name = create_and_submit_payment_entry(
                invoice_name,
                mode_of_payment=self.payment_method,
                paid_account=paid_account,
                reference_no=reference_no or self.get_public_reference(),
            )
            self.payment_entry = payment_entry_name

        self.flags.ignore_validate = True
        self.save()
        self.flags.ignore_validate = False

        return invoice_name, payment_entry_name

    def confirm_payment_and_invoice(self, payment_method=None, paid_account=None):
        """Mark paid, create/submit Sales Invoice and Payment Entry, confirm booking."""
        if self.reservation_status == VOID:
            frappe.throw("Cannot record payment on a voided reservation.")
        if self.payment_status == "Refunded":
            frappe.throw("Cannot record payment on a refunded booking.")

        invoice_name, payment_entry_name = self._ensure_main_fare_invoice_and_payment(
            payment_method=payment_method,
            paid_account=paid_account,
        )

        self.payment_status = "Paid"

        if self.reservation_status == BOOKED:
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
            "pnr": self.pnr,
            "reservation_ref": self.name,
            "reservation_status": self.reservation_status,
            "booking_status": self.reservation_status,
            "payment_status": self.payment_status,
        }

    def confirm_on_credit_and_invoice(self):
        """Agent credit: bill on the accounting site, then issue PNR and consume agent credit."""
        if self.reservation_status == VOID:
            frappe.throw("Cannot confirm on credit for a voided reservation.")
        if self.payment_status == "Refunded":
            frappe.throw("Cannot confirm on credit for a refunded booking.")

        if self.reservation_status == CONFIRM and self.pnr:
            invoice_name, payment_entry_name = self._ensure_main_fare_invoice_and_payment(
                reference_no=f"{self.get_public_reference()} (agent credit)",
            )
            frappe.db.commit()
            return {
                "success": True,
                "pnr": self.pnr,
                "already_confirmed": True,
                "reservation_ref": self.name,
                "invoice": invoice_name,
                "payment_entry": payment_entry_name,
            }

        self.calculate_total_fare()
        if not flt(self.total_fare):
            self._ensure_confirmable_fare_for_credit()

        self._validate_agent_credit_for_confirmation()

        invoice_name, payment_entry_name = self._ensure_main_fare_invoice_and_payment(
            reference_no=f"{self.get_public_reference()} (agent credit)",
        )

        result = self.confirm_booking(via_credit=True)
        result["invoice"] = invoice_name
        result["payment_entry"] = payment_entry_name
        return result

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