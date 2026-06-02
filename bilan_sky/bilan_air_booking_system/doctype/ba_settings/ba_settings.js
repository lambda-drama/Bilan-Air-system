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

		frm.add_custom_button(__('Load remote accounting options'), () => {
			load_remote_accounting_into_form(frm, true);
		});

		load_remote_accounting_into_form(frm, false);
	},
});

function load_remote_accounting_into_form(frm, show_message) {
	frappe.call({
		method:
			'bilan_sky.bilan_air_booking_system.api.remote_accounting.get_remote_accounting_options',
		callback(r) {
			if (!r.message?.enabled) {
				if (show_message) {
					frappe.msgprint(__('Set Site URL, API Key, Secret Key, and Company first.'));
				}
				return;
			}

			const mode_options = (r.message.modes_of_payment || []).map((m) => m.name).join('\n');
			const account_options = (r.message.accounts || []).map((a) => a.name).join('\n');

			frm.set_df_property('default_mode_of_payment', 'options', mode_options);
			frm.set_df_property('default_cash_account', 'options', account_options);
			frm.set_df_property('default_mpesa_account', 'options', account_options);

			if (show_message) {
				frappe.msgprint({
					title: __('Remote company: {0}', [r.message.company]),
					message: __('Loaded {0} payment mode(s) and {1} bank/cash account(s) for autocomplete.', [
						(r.message.modes_of_payment || []).length,
						(r.message.accounts || []).length,
					]),
					indicator: 'green',
				});
			}
		},
	});
}
