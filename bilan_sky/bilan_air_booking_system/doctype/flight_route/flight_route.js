// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on("Flight Route", {
	refresh(frm) {
		preview_route_name(frm);
	},
	origin_airport(frm) {
		preview_route_name(frm);
	},
	destination_airport(frm) {
		preview_route_name(frm);
	},
	is_multi_segment(frm) {
		preview_route_name(frm);
	},
});

frappe.ui.form.on("Flight Route Segment", {
	route_segments_add(frm) {
		preview_route_name(frm);
	},
	route_segments_remove(frm) {
		preview_route_name(frm);
	},
	origin_airport(frm, cdt, cdn) {
		preview_route_name(frm);
	},
	destination_airport(frm, cdt, cdn) {
		preview_route_name(frm);
	},
});

async function preview_route_name(frm) {
	if (frm.doc.is_multi_segment) {
		if (!frm.doc.route_segments || frm.doc.route_segments.length < 2) {
			return;
		}
		const segments = frm.doc.route_segments.map((row) => ({
			segment_index: row.segment_index,
			origin_airport: row.origin_airport,
			destination_airport: row.destination_airport,
		}));
		const r = await frappe.call({
			method:
				"bilan_sky.bilan_air_booking_system.doctype.flight_route.flight_route.preview_route_name",
			args: {
				is_multi_segment: 1,
				segments,
			},
		});
		if (r.message) {
			frm.set_value("route_name", r.message);
		}
		return;
	}

	if (!frm.doc.origin_airport || !frm.doc.destination_airport) {
		return;
	}
	if (frm.doc.origin_airport === frm.doc.destination_airport) {
		frappe.msgprint(__("Origin and destination airports cannot be the same."));
		return;
	}

	const r = await frappe.call({
		method:
			"bilan_sky.bilan_air_booking_system.doctype.flight_route.flight_route.preview_route_name",
		args: {
			origin_airport: frm.doc.origin_airport,
			destination_airport: frm.doc.destination_airport,
			is_multi_segment: 0,
		},
	});
	if (r.message) {
		frm.set_value("route_name", r.message);
	}
}
