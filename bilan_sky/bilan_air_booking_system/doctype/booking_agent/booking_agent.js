// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on("Booking Agent", {
	confirmation_mode(frm) {
		if (frm.doc.confirmation_mode === "Booking Only") {
			frm.set_value("credit_limit", 0);
			frm.set_value("allow_credit", 0);
		}
	},
});
