// Copyright (c) 2026, NF and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Schedule Plan', {
	refresh(frm) {
		const query = 'bilan_sky.bilan_air_booking_system.utils.crew_filters.crew_member_link_query';
		frm.set_query('captain', () => ({ query, filters: { capacity: 'captain' } }));
		frm.set_query('first_officer', () => ({ query, filters: { capacity: 'first_officer' } }));

		if (frm.is_new()) {
			return;
		}
		frm.add_custom_button(__('Preview Count'), () => {
			frappe.call({
				method: 'bilan_sky.bilan_air_booking_system.api.flight_schedule_plan.preview_plan_occurrences',
				args: { plan_name: frm.doc.name },
				callback(r) {
					if (r.message) {
						frappe.msgprint(
							__('This plan will create {0} flight(s).', [r.message.count]),
							__('Occurrence preview')
						);
					}
				},
			});
		});

		frm.add_custom_button(__('Generate Flights'), () => {
			frappe.confirm(
				__('Create flight schedules for all dates in this plan? Existing flights on the same date are skipped.'),
				() => {
					frappe.call({
						method: 'bilan_sky.bilan_air_booking_system.api.flight_schedule_plan.generate_plan_schedules',
						args: { plan_name: frm.doc.name, submit: 1 },
						callback(r) {
							if (!r.message) {
								return;
							}
							frappe.show_alert({
								message: __('Generating {0} flight schedule(s) in the background.', [
									r.message.expected_count,
								]),
								indicator: 'blue',
							});
						},
					});
				}
			);
		}, __('Actions'));
	},
});
