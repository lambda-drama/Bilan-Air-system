// Copyright (c) 2026, NF and contributors

frappe.ui.form.on("Website Contact Message", {
	refresh(frm) {
		if (frm.doc.status === "New") {
			frm.add_custom_button(__("Mark In Progress"), () => {
				frm.set_value("status", "In Progress");
				frm.save();
			});
		}
		if (["New", "In Progress"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Mark Replied"), () => {
				frm.set_value("status", "Replied");
				frm.save();
			});
		}
		if (frm.doc.status !== "Closed") {
			frm.add_custom_button(__("Close"), () => {
				frm.set_value("status", "Closed");
				frm.save();
			});
		}
	},
});
