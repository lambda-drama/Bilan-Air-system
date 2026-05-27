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
        check_booking_cutoff(frm);
    },

    route: function(frm) {
        preview_flight_number(frm);
    },

    airplane: function(frm) {
        preview_flight_number(frm);
    },

    departure_date: function(frm) {
        preview_flight_number(frm);
        check_booking_cutoff(frm);
    },
    
    departure_time: function(frm) {
        check_booking_cutoff(frm);
    }
});

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