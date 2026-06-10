// Copyright (c) 2026, NF and contributors

frappe.ui.form.on('BA Settings', {
	refresh(frm) {
		frm.add_custom_button(__('Test accounting connection'), () => {
			frappe.call({
				method:
					'bilan_sky.bilan_air_booking_system.api.remote_accounting.test_remote_accounting_connection',
				freeze: true,
				freeze_message: __('Connecting to accounting site...'),
				callback(r) {
					if (r.message?.success) {
						frappe.msgprint({
							title: __('Connected'),
							message: __('Accounting site: {0}<br>Company: {1}', [
								r.message.site_url,
								r.message.company,
							]),
							indicator: 'green',
						});
					}
				},
			});
		});
	},
});
