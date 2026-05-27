// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Air Booking", {
// 	refresh(frm) {

// 	},
// });

// Client Script: Air Booking
// Validates seat selection and booking cutoff

frappe.ui.form.on('Air Booking', {
    refresh: function(frm) {
        validate_booking_cutoff(frm);
        update_seat_availability_message(frm);
        
        // Add custom buttons
        if (frm.doc.booking_status === 'Reserved' && frm.doc.payment_status === 'Paid') {
            frm.add_custom_button('Confirm Booking', function() {
                confirm_booking(frm);
            });
        }
        
        if (frm.doc.booking_status === 'Paid') {
            frm.add_custom_button('Check-in', function() {
                frm.save().then(() => {
                    frappe.set_route('Form', 'Air Booking Check-in', frm.doc.name);
                });
            });
        }

        if (!frm.is_new() && frm.doc.passengers && frm.doc.passengers.length) {
            frm.add_custom_button(__('Generate Ticket Numbers'), function() {
                generate_ticket_numbers(frm);
            }, __('Actions'));
        }
    },
    
    flight_schedule: function(frm) {
        validate_booking_cutoff(frm);
        get_flight_details(frm);
    },
     before_save: function(frm) {
        return validate_passengers(frm);
    },
    
    before_submit: function(frm) {
        return validate_before_submit(frm);
    }
});

// Child table: Passengers
frappe.ui.form.on('Air Booking Passenger', {
    seat_number: function(frm, cdt, cdn) {
        var row = frappe.get_doc(cdt, cdn);
        validate_seat_availability(frm, row);
        update_passenger_fare(frm, row);
    },
    
    passengers_remove: function(frm) {
        calculate_total_fare(frm);
    }
});

function validate_booking_cutoff(frm) {
    if (!frm.doc.flight_schedule) return;
    
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Flight Schedule', name: frm.doc.flight_schedule },
        callback: function(response) {
            var flight = response.message;
            
            frappe.call({
                method: 'frappe.client.get',
                args: { doctype: 'BA Settings' },
                callback: function(settings_res) {
                    var settings = settings_res.message;
                    var cutoff_hours = settings.booking_cutoff_hours || 2;
                    
                    var departure = frappe.datetime.str_to_obj(flight.departure_date);
                    var time_parts = flight.departure_time.split(':');
                    departure.setHours(parseInt(time_parts[0]), parseInt(time_parts[1]));
                    
                    var cutoff = new Date(departure.getTime() - (cutoff_hours * 60 * 60 * 1000));
                    var now = new Date();
                    
                    if (now > cutoff && frm.is_new()) {
                        frappe.msgprint({
                            title: 'Booking Closed',
                            message: `Booking cutoff for this flight was ${frappe.datetime.obj_to_str(cutoff)}. Please select another flight.`,
                            indicator: 'red'
                        });
                        frm.set_value('flight_schedule', null);
                    }
                }
            });
        }
    });
}

function validate_seat_availability(frm, row) {
    if (!row.seat_number) return;
    
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Seat Inventory', name: row.seat_number },
        callback: function(response) {
            var seat = response.message;
            
            if (seat.status !== 'Available' && seat.booking_reference !== frm.doc.name) {
                frappe.msgprint({
                    title: 'Seat Unavailable',
                    message: `Seat ${seat.seat_number} is already ${seat.status.toLowerCase()}. Please select another seat.`,
                    indicator: 'red'
                });
                frappe.model.set_value(row.doctype, row.name, 'seat_number', null);
            } else {
                frappe.show_alert({
                    message: `Seat ${seat.seat_number} (${seat.seat_class}) is available`,
                    indicator: 'green'
                });
            }
        }
    });
}

function get_flight_details(frm) {
    if (!frm.doc.flight_schedule) return;
    
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Flight Schedule', name: frm.doc.flight_schedule },
        callback: function(response) {
            var flight = response.message;
            frm.set_df_property('flight_schedule', 'description', 
                `${flight.flight_number} | ${flight.departure_date} ${flight.departure_time}`);
        }
    });
}

function update_passenger_fare(frm, row) {
    if (!row.seat_number) return;
    
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Seat Inventory', name: row.seat_number },
        callback: function(seat_res) {
            var seat = seat_res.message;
            
            frappe.call({
                method: 'frappe.client.get',
                args: { doctype: 'Flight Schedule', name: frm.doc.flight_schedule },
                callback: function(flight_res) {
                    var flight = flight_res.message;
                    
                    frappe.call({
                        method: 'frappe.client.get',
                        args: { doctype: 'Flight Route', name: flight.route },
                        callback: function(route_res) {
                            var route = route_res.message;
                            var base_fare = flight.base_fare_override || route.base_fare;
                            
                            frappe.call({
                                method: 'frappe.client.get',
                                args: { doctype: 'Seat Class', name: seat.seat_class },
                                callback: function(class_res) {
                                    var seat_class = class_res.message;
                                    var estimated_fare = base_fare * seat_class.price_multiplier;
                                    
                                    frappe.model.set_value(row.doctype, row.name, 'fare_paid', estimated_fare);
                                    calculate_total_fare(frm);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function calculate_total_fare(frm) {
    var total = 0;
    $.each(frm.doc.passengers || [], function(i, row) {
        total += row.fare_paid || 0;
    });
    frm.set_value('total_fare', total);
}

function generate_ticket_numbers(frm) {
    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.api.air_booking.generate_tickets_for_booking',
        args: { pnr: frm.doc.name },
        freeze: true,
        freeze_message: __('Generating ticket numbers...'),
        callback: function(r) {
            if (!r.message) {
                return;
            }

            frm.reload_doc().then(() => {
                frappe.show_alert({
                    message: __('Generated {0} ticket number(s)', [r.message.count]),
                    indicator: 'green',
                });
            });
        },
    });
}

function confirm_booking(frm) {
    frappe.confirm('Confirm this booking and issue tickets?', function() {
        frappe.call({
            method: 'frappe.client.get',
            args: { doctype: 'Air Booking', name: frm.doc.name },
            callback: function(response) {
                var booking = response.message;
                
                // Call the confirm_booking method
                frappe.call({
                    method: 'frappe.client.call',
                    args: {
                        doctype: 'Air Booking',
                        name: frm.doc.name,
                        method: 'confirm_booking'
                    },
                    callback: function(result) {
                        frappe.msgprint({
                            title: 'Booking Confirmed',
                            message: `PNR: ${frm.doc.name}\nTickets have been issued.`,
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                });
            }
        });
    });
}


function validate_passengers(frm) {
    if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
        frappe.msgprint('Please add at least one passenger');
        return false;
    }
    
    // Check all passengers have seats
    for (var i = 0; i < frm.doc.passengers.length; i++) {
        var row = frm.doc.passengers[i];
        if (!row.seat_number) {
            frappe.msgprint(`Please select a seat for passenger ${i + 1}`);
            return false;
        }
    }
    
    return true;
}

function validate_before_submit(frm) {
    // Check payment status
    if (frm.doc.payment_status !== 'Paid') {
        frappe.msgprint('Booking cannot be submitted until payment is completed');
        return false;
    }
    
    // Check all passengers have ticket numbers
    for (var i = 0; i < frm.doc.passengers.length; i++) {
        var row = frm.doc.passengers[i];
        if (!row.ticket_number) {
            frappe.msgprint(`Ticket number missing for passenger ${i + 1}`);
            return false;
        }
    }
    
    return true;
}