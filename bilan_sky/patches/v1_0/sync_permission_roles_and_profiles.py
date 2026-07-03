import frappe


def execute():
	from bilan_sky.bilan_air_booking_system.api.portal_master import (
		_ensure_allowed_permission_roles,
		_ensure_default_role_profiles,
	)

	_ensure_allowed_permission_roles()
	_ensure_default_role_profiles(sync_existing=True)
	frappe.db.commit()
