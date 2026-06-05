// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Flight Schedule", {
// 	refresh(frm) {

// 	},
// });

// Client Script: Flight Schedule
// Shows warning if current time is past booking cutoff

frappe.ui.form.on('Flight Schedule', {
    refresh: function(frm) {
        setup_crew_queries(frm);
        check_booking_cutoff(frm);
        if (!frm.is_new()) {
            frm.add_custom_button(__('Reschedule Flight'), function() {
                open_reschedule_dialog(frm);
            }, __('Actions'));
        }
        if (frm.is_new() && frm._arrival_manually_set === undefined) {
            frm._arrival_manually_set = false;
        }
    },

    route: function(frm) {
        preview_flight_number(frm);
        estimate_arrival_from_route(frm);
    },

    airplane: function(frm) {
        preview_flight_number(frm);
    },

    departure_date: function(frm) {
        preview_flight_number(frm);
        check_booking_cutoff(frm);
        estimate_arrival_from_route(frm);
    },

    departure_time: function(frm) {
        check_booking_cutoff(frm);
        estimate_arrival_from_route(frm);
    },

    arrival_date: function(frm) {
        frm._arrival_manually_set = true;
    },

    arrival_time: function(frm) {
        frm._arrival_manually_set = true;
    },
});

function setup_crew_queries(frm) {
    const query = 'bilan_sky.bilan_air_booking_system.utils.crew_filters.crew_member_link_query';
    frm.set_query('captain', () => ({ query, filters: { capacity: 'captain' } }));
    frm.set_query('first_officer', () => ({ query, filters: { capacity: 'first_officer' } }));
}

function open_reschedule_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: __('Reschedule Flight {0}', [frm.doc.name]),
        fields: [
            {
                fieldname: 'reschedule_reason',
                label: __('Reschedule Reason'),
                fieldtype: 'Select',
                options: 'Weather\nTechnical Issue\nOperational\nCrew Availability\nAirport Closure\nOther',
                reqd: 1
            },
            {
                fieldname: 'new_departure_date',
                label: __('New Departure Date'),
                fieldtype: 'Date',
                default: frm.doc.departure_date,
                reqd: 1
            },
            {
                fieldname: 'new_departure_time',
                label: __('New Departure Time'),
                fieldtype: 'Time',
                default: frm.doc.departure_time,
                reqd: 1
            },
            {
                fieldname: 'new_arrival_date',
                label: __('New Arrival Date'),
                fieldtype: 'Date',
                default: frm.doc.arrival_date,
                reqd: 1
            },
            {
                fieldname: 'new_arrival_time',
                label: __('New Arrival Time'),
                fieldtype: 'Time',
                default: frm.doc.arrival_time,
                reqd: 1
            },
            {
                fieldname: 'new_airplane',
                label: __('New Airplane (optional)'),
                fieldtype: 'Link',
                options: 'Airplane',
                default: frm.doc.airplane
            },
            {
                fieldname: 'notes',
                label: __('Notes'),
                fieldtype: 'Small Text'
            }
        ],
        primary_action_label: __('Apply Reschedule'),
        primary_action(values) {
            frappe.call({
                method: 'bilan_sky.bilan_air_booking_system.doctype.flight_schedule.flight_schedule.reschedule_flight',
                args: {
                    schedule_name: frm.doc.name,
                    ...values
                },
                freeze: true,
                freeze_message: __('Rescheduling flight...'),
                callback: function(r) {
                    if (r.message) {
                        dialog.hide();
                        frappe.show_alert({
                            message: __('Flight rescheduled. Log: {0}', [r.message.rescheduling_log]),
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    }
                }
            });
        }
    });
    dialog.show();
}

function estimate_arrival_from_route(frm) {
    if (frm._arrival_manually_set) {
        return;
    }
    if (!frm.doc.route || !frm.doc.departure_date || !frm.doc.departure_time) {
        return;
    }

    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.doctype.flight_schedule.flight_schedule.estimate_arrival_from_route',
        args: {
            route: frm.doc.route,
            departure_date: frm.doc.departure_date,
            departure_time: frm.doc.departure_time,
        },
        callback: function(r) {
            const estimate = r.message;
            if (!estimate) {
                return;
            }
            if (estimate.arrival_date) {
                frm.set_value('arrival_date', estimate.arrival_date);
            }
            if (estimate.arrival_time) {
                frm.set_value('arrival_time', estimate.arrival_time);
            }
            if (estimate.segments && frm.doc.segments) {
                estimate.segments.forEach(function(seg) {
                    const row = (frm.doc.segments || []).find(
                        (s) => parseInt(s.segment_index, 10) === parseInt(seg.segment_index, 10)
                    );
                    if (!row) {
                        return;
                    }
                    frappe.model.set_value(
                        row.doctype,
                        row.name,
                        'duration',
                        seg.duration || null
                    );
                    frappe.model.set_value(
                        row.doctype,
                        row.name,
                        'arrival_date',
                        seg.arrival_date || null
                    );
                    frappe.model.set_value(
                        row.doctype,
                        row.name,
                        'arrival_time',
                        seg.arrival_time || null
                    );
                });
            }
        },
    });
}

function preview_flight_number(frm) {
    if (!frm.doc.airplane || !frm.doc.route || !frm.doc.departure_date) {
        return;
    }

    frappe.call({
        method: 'bilan_sky.bilan_air_booking_system.utils.flight_numbering.preview_flight_number',
        args: {
            airplane: frm.doc.airplane,
            route: frm.doc.route,
            departure_date: frm.doc.departure_date,
        },
        callback: function(r) {
            if (r.message) {
                frm.set_value('flight_number', r.message);
            }
        },
    });
}

function check_booking_cutoff(frm) {
    if (!frm.doc.departure_date || !frm.doc.departure_time) {
        return;
    }
    
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'BA Settings' },
        callback: function(response) {
            var settings = response.message;
            var cutoff_hours = settings.booking_cutoff_hours || 2;
            
            // Calculate cutoff datetime
            var departure = frappe.datetime.str_to_obj(frm.doc.departure_date);
            var time_parts = frm.doc.departure_time.split(':');
            departure.setHours(parseInt(time_parts[0]), parseInt(time_parts[1]));
            
            var cutoff = new Date(departure.getTime() - (cutoff_hours * 60 * 60 * 1000));
            var now = new Date();
            
            if (now > cutoff) {
                frm.set_df_property('flight_number', 'description', 
                    '⚠️ Warning: Booking cutoff was ' + frappe.datetime.obj_to_str(cutoff));
                frappe.show_alert({
                    message: 'Booking cutoff has passed for this flight',
                    indicator: 'red'
                });
            } else {
                frm.set_df_property('flight_number', 'description', 
                    'Booking cutoff: ' + frappe.datetime.obj_to_str(cutoff));
            }
        }
    });
}