// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on("Booking Agent", {
	refresh(frm) {
		sync_rights_dependent_fields(frm);
		if (frm.is_new()) {
			apply_agent_profile_name(frm);
		}
	},
	booking_company(frm) {
		apply_agent_profile_name(frm);
	},
	username(frm) {
		apply_agent_profile_name(frm);
	},
	email(frm) {
		apply_agent_profile_name(frm);
	},
	user(frm) {
		apply_agent_profile_name(frm);
	},
	can_confirm_ticket(frm) {
		sync_rights_dependent_fields(frm);
	},
	deposit_required(frm) {
		sync_rights_dependent_fields(frm);
	},
	can_book_ticket(frm) {
		sync_rights_dependent_fields(frm);
	},
	status(frm) {
		sync_rights_dependent_fields(frm);
	},
	credit_limit(frm) {
		sync_rights_dependent_fields(frm);
	},
	validate(frm) {
		return apply_agent_profile_name(frm);
	},
});

function apply_agent_profile_name(frm) {
	if (!frm.doc.booking_company) {
		return Promise.resolve();
	}
	return frappe
		.call({
			method:
				"bilan_sky.bilan_air_booking_system.doctype.booking_agent.booking_agent.get_agent_profile_name",
			args: {
				booking_company: frm.doc.booking_company,
				username: frm.doc.username,
				email: frm.doc.email,
				user: frm.doc.user,
				docname: frm.doc.name,
			},
			freeze: false,
		})
		.then((r) => {
			if (r.message) {
				frm.set_value("agent_name", r.message);
			}
		});
}

function sync_rights_dependent_fields(frm) {
	const can_confirm = frm.doc.can_confirm_ticket === "Yes";
	const deposit = frm.doc.deposit_required === "Yes";

	frm.toggle_reqd("credit_limit", can_confirm && !deposit);
	if (!can_confirm || deposit) {
		frm.set_value("credit_limit", 0);
	}
}
