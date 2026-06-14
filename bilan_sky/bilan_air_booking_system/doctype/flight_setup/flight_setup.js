// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Setup', {
	refresh(frm) {
		if (!frm.is_new() && frm.doc.route) {
			frm.add_custom_button(__('View recurring plans'), () => {
				frappe.set_route('List', 'Flight Schedule Plan', { flight_number: frm.doc.name });
			});
		}
	},
});
