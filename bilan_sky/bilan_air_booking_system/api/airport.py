# bilan_air/api/airport.py

import frappe

@frappe.whitelist(allow_guest=True)
def fetch_all_airports():
    """Get all airports"""
    return frappe.get_all("Airport", fields=["name", "airport_name", "iata_code", "city", "country"])

@frappe.whitelist(allow_guest=True)
def fetch_airport_by_iata(iata_code):
    """Get airport by IATA code"""
    return frappe.get_doc("Airport", iata_code)

@frappe.whitelist(allow_guest=True)
def find_airports(keyword):
    """Search airports by name or code"""
    return frappe.get_all("Airport",
        filters={
            "airport_name": ["like", f"%{keyword}%"],
            "is_active": 1
        },
        or_filters={
            "iata_code": ["like", f"%{keyword}%"],
            "city": ["like", f"%{keyword}%"]
        },
        fields=["name", "airport_name", "iata_code", "city"]
    )