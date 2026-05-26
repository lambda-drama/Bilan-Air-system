# bilan_air/api/airline.py

import frappe

@frappe.whitelist(allow_guest=True)
def fetch_all_airlines():
    """Get all airlines"""
    return frappe.get_all("Airline", fields=["name", "airline_name", "iata_code", "country"])

@frappe.whitelist(allow_guest=True)
def fetch_airline_by_iata(iata_code):
    """Get airline by IATA code"""
    return frappe.get_doc("Airline", iata_code)