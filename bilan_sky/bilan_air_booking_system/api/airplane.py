# bilan_air/api/airplane.py

import frappe

@frappe.whitelist(allow_guest=True)
def fetch_all_airplanes():
    """Get all active airplanes"""
    return frappe.get_all("Airplane",
        filters={"status": "Active"},
        fields=["name", "registration_number", "aircraft_model", "airline", "total_seats"]
    )

@frappe.whitelist(allow_guest=True)
def fetch_airplane_seat_config(airplane_name):
	"""Get seat configuration for an airplane."""
	airplane = frappe.get_doc("Airplane", airplane_name)
	return [r.as_dict() for r in airplane.seat_config or []]