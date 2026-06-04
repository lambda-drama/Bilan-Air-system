// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Air Booking", {
// 	refresh(frm) {

// 	},
// });

// Client Script: Air Booking
// Validates seat selection and booking cutoff

frappe.ui.form.on('Air Booking', {
    onload: function(frm) {
        setup_remote_payment_method_options(frm);
    },

    refresh: function(frm) {
        validate_booking_cutoff(frm);
        update_seat_availability_message(frm);
        setup_remote_payment_method_options(frm);

        if (!frm.is_new() && !frm.doc.pnr && frm.doc.reservation_status === 'Booked') {
            frm.set_intro(
                __('Reservation {0} is not confirmed yet. PNR (e.g. BA-00001) and ticket numbers are issued only after payment or approved agent credit.', [
                    frm.doc.reservation_ref || frm.doc.name,
                ]),
                'blue'
            );
        } else {
            frm.set_intro('');
        }
        
        // Add custom buttons
        if (frm.doc.reservation_status === 'Booked' && frm.doc.payment_status === 'Paid') {
            frm.add_custom_button('Confirm Booking', function() {
                confirm_booking(frm);
            });
        }
        
        if (frm.doc.reservation_status === 'Confirm') {
            frm.add_custom_button('Check-in', function() {
                frm.save().then(() => {
                    frappe.set_route('Form', 'Air Booking Check-in', frm.doc.name);
                });
            });
        }

        if (!frm.is_new() && frm.doc.reservation_status === 'Confirm') {
            frm.add_custom_button(__('Check-in All Passengers'), function() {
                trigger_booking_action(
                    frm,
                    'bilan_sky.bilan_air_booking_system.api.air_booking.check_in_all_passengers',
                    __('Checking in passengers...')
                );
            }, __('Status Actions'));
        }

        const has_checked_in = (frm.doc.passengers || []).some(
            (p) => p.check_in_status === 'Checked In'
        );
        if (!frm.is_new() && frm.doc.reservation_status === 'Confirm' && has_checked_in) {
            frm.add_custom_button(__('Board All Passengers'), function() {
                trigger_booking_action(
                    frm,
                    'bilan_sky.bilan_air_booking_system.api.air_booking.board_all_passengers',
                    __('Boarding passengers...')
                );
            }, __('Status Actions'));
        }

        if (!frm.is_new() && frm.doc.reservation_status === 'Confirm') {
            frm.add_custom_button(__('Mark Flight Taken'), function() {
                trigger_booking_action(
                    frm,
                    'bilan_sky.bilan_air_booking_system.api.air_booking.mark_booking_arrived',
                    __('Marking reservation as flight taken...')
                );
            }, __('Status Actions'));
        }

        if (!frm.is_new() && frm.doc.passengers && frm.doc.passengers.length) {
            frm.add_custom_button(__('Generate Ticket Numbers'), function() {
                generate_ticket_numbers(frm);
            }, __('Actions'));
        }

        if (!frm.is_new() && frm.doc.reservation_status === 'Booked') {
            frm.add_custom_button(__('Confirm on Credit (PNR)'), function() {
                trigger_booking_action(
                    frm,
                    'bilan_sky.bilan_air_booking_system.api.air_booking.confirm_booking_on_credit',
                    __('Confirming on agent credit and issuing PNR...')
                );
            }, __('Payment'));
        }

        if (!frm.is_new() && frm.doc.reservation_status !== 'Void' && frm.doc.payment_status !== 'Refunded') {
            if (frm.doc.payment_status === 'Pending' || !frm.doc.payment_entry) {
                frm.add_custom_button(__('Confirm Payment (Invoice + Payment)'), function() {
                    confirm_payment_and_invoice(frm);
                }, __('Payment'));
            }

            frm.add_custom_button(__('Create Sales Invoice'), function() {
                create_sales_invoice(frm);
            }, __('Payment'));
        }
    },
    
    flight_schedule: function(frm) {
        validate_booking_cutoff(frm);
        get_flight_details(frm);
        update_seat_availability_message(frm);
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
    passenger: function(frm, cdt, cdn) {
        sync_passenger_from_profile(frm, cdt, cdn);
    },

    id_number: function(frm, cdt, cdn) {
        lookup_passenger_by_id(frm, cdt, cdn);
    },

    passenger_type: function(frm, cdt, cdn) {
        var row = frappe.get_doc(cdt, cdn);
        if (row.seat_number) {
            update_passenger_fare(frm, row);
        }
    },

    seat_number: function(frm, cdt, cdn) {
        var row = frappe.get_doc(cdt, cdn);
        validate_seat_availability(frm, row);
        update_passenger_fare(frm, row);
    },
    
    passengers_remove: function(frm) {
        calculate_total_fare(frm);
    }
});

function sync_passenger_from_profile(frm, cdt, cdn) {
    var row = frappe.get_doc(cdt, cdn);
    if (!row.passenger) {
        return;
    }

    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Passenger', name: row.passenger },
        callback: function(r) {
            var profile = r.message;
            if (!profile) {
                return;
            }
            frappe.model.set_value(cdt, cdn, 'passenger_name', profile.full_name);
            frappe.model.set_value(cdt, cdn, 'passenger_type', profile.passenger_type || 'Adult');
            if (profile.id_number) {
                frappe.model.set_value(cdt, cdn, 'id_number', profile.id_number);
            }
            if (row.seat_number) {
                update_passenger_fare(frm, frappe.get_doc(cdt, cdn));
            }
        },
    });
}

function lookup_passenger_by_id(frm, cdt, cdn) {
    var row = frappe.get_doc(cdt, cdn);
    if (!row.id_number || row.passenger) {
        return;
    }

    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.api.passenger.lookup_passenger_by_id',
        args: { id_number: row.id_number },
        callback: function(r) {
            if (!r.message) {
                return;
            }
            frappe.model.set_value(cdt, cdn, 'passenger', r.message.name);
            sync_passenger_from_profile(frm, cdt, cdn);
        },
    });
}

function setup_remote_payment_method_options(frm) {
    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.api.remote_accounting.get_remote_accounting_options',
        callback: function(r) {
            if (!r.message || !r.message.enabled) {
                return;
            }
            const options = (r.message.modes_of_payment || []).map(function(m) { return m.name; }).join('\n');
            frm.set_df_property('payment_method', 'options', options);
        },
    });
}

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
    update_seat_availability_message(frm);
}

function update_seat_availability_message(frm) {
    if (!frm.doc.flight_schedule) {
        return;
    }

    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Flight Schedule', name: frm.doc.flight_schedule },
        callback: function(flight_res) {
            const flight = flight_res.message;
            if (!flight) {
                return;
            }

            frappe.call({
                method: 'frappe.client.get_count',
                args: {
                    doctype: 'Seat Inventory',
                    filters: {
                        flight_schedule: frm.doc.flight_schedule,
                        status: 'Available',
                    },
                },
                callback: function(count_res) {
                    const available = count_res.message || 0;
                    const passenger_count = (frm.doc.passengers || []).length;
                    let description = `${flight.flight_number} | ${flight.departure_date} ${flight.departure_time}`;
                    description += ` | ${available} seat(s) available`;

                    if (passenger_count && available < passenger_count) {
                        description += ` (${passenger_count} needed)`;
                        frappe.show_alert({
                            message: __('Only {0} seats available for {1} passengers', [
                                available,
                                passenger_count,
                            ]),
                            indicator: 'orange',
                        });
                    }

                    frm.set_df_property('flight_schedule', 'description', description);
                },
            });
        },
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
                            var ptype = (row.passenger_type || 'Adult').toLowerCase();
                            var fares = {
                                adult: route.base_fare_adult || route.base_fare,
                                child: route.base_fare_child,
                                infant: route.base_fare_infant,
                            };
                            if (typeof route.base_fares === 'string' && route.base_fares) {
                                try {
                                    var parsed = JSON.parse(route.base_fares);
                                    fares = Object.assign(fares, parsed);
                                } catch (e) { /* ignore */ }
                            } else if (route.base_fares && typeof route.base_fares === 'object') {
                                fares = Object.assign(fares, route.base_fares);
                            }
                            var override = {
                                adult: flight.base_fare_adult_override,
                                child: flight.base_fare_child_override,
                                infant: flight.base_fare_infant_override,
                            };
                            if (typeof flight.base_fares_override === 'string' && flight.base_fares_override) {
                                try {
                                    override = Object.assign(override, JSON.parse(flight.base_fares_override));
                                } catch (e) { /* ignore */ }
                            }
                            if (!override.adult && flight.base_fare_override) {
                                override.adult = flight.base_fare_override;
                            }
                            var base_fare = (override[ptype] != null && override[ptype] !== '')
                                ? override[ptype]
                                : (fares[ptype] != null ? fares[ptype] : route.base_fare);
                            
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

function trigger_booking_action(frm, method, freeze_message) {
    frappe.call({
        method: method,
        args: { pnr: frm.doc.name },
        freeze: true,
        freeze_message: freeze_message,
        callback: function(r) {
            frappe.show_alert({
                message: r.message?.message || __('Booking updated'),
                indicator: 'green'
            });
            frm.reload_doc();
        }
    });
}

function create_sales_invoice(frm) {
    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.api.air_booking.create_sales_invoice_from_booking',
        args: { pnr: frm.doc.name },
        freeze: true,
        freeze_message: __('Creating sales invoice...'),
        callback: function(r) {
            if (!r.message || !r.message.invoice) {
                return;
            }
            frappe.show_alert({
                message: __('Sales Invoice {0} created', [r.message.invoice]),
                indicator: 'green'
            });
            frm.reload_doc();
        }
    });
}

function confirm_payment_and_invoice(frm) {
    if (!frm.doc.payment_method) {
        frappe.msgprint(__('Select a Payment Method first.'));
        return;
    }

    frappe.confirm(
        __('Create Sales Invoice and Payment Entry, mark payment as Paid, and confirm this booking?'),
        function() {
            frappe.call({
                method: 'bilan_sky.bilan_air_booking_system.api.air_booking.confirm_payment_and_invoice_from_booking',
                args: { pnr: frm.doc.name },
                freeze: true,
                freeze_message: __('Recording payment...'),
                callback: function(r) {
                    if (!r.message || !r.message.success) {
                        return;
                    }
                    frappe.msgprint({
                        title: __('Payment Recorded'),
                        message: __('Invoice: {0}<br>Payment Entry: {1}', [
                            r.message.invoice,
                            r.message.payment_entry,
                        ]),
                        indicator: 'green',
                    });
                    frm.reload_doc();
                },
            });
        }
    );
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

    if (!(frm.doc.payer_name || '').trim()) {
        frappe.msgprint(__('Payer Full Name is required (used for invoicing).'));
        return false;
    }
    
    // Check all passengers have names and seats
    for (var i = 0; i < frm.doc.passengers.length; i++) {
        var row = frm.doc.passengers[i];
        if (!(row.passenger_name || '').trim()) {
            frappe.msgprint(`Please enter a name for traveler ${i + 1}`);
            return false;
        }
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