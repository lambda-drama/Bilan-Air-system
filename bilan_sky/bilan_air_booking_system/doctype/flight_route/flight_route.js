// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on("Flight Route", {
	origin_airport(frm) {
		preview_route_name(frm);
	},
	destination_airport(frm) {
		preview_route_name(frm);
	},
});

async function preview_route_name(frm) {
	if (!frm.doc.origin_airport || !frm.doc.destination_airport) {
		return;
	}
	if (frm.doc.origin_airport === frm.doc.destination_airport) {
		frappe.msgprint(__("Origin and destination airports cannot be the same."));
		return;
	}

	const origin = await frappe.db.get_value("Airport", frm.doc.origin_airport, "iata_code");
	const destination = await frappe.db.get_value(
		"Airport",
		frm.doc.destination_airport,
		"iata_code"
	);

	if (origin.message && destination.message) {
		frm.set_value(
			"route_name",
			`${origin.message}-${destination.message}`.toUpperCase()
		);
	}
}
