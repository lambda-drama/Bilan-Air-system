# bilan_air/api/passenger.py

import frappe

@frappe.whitelist(allow_guest=True)
def register_passenger(passenger_data):
    """Create a new passenger"""
    
    existing = frappe.db.exists("Passenger", {"id_number": passenger_data.get("id_number")})
    
    if existing:
        return frappe.get_doc("Passenger", existing)
    
    passenger = frappe.get_doc({
        "doctype": "Passenger",
        "full_name": passenger_data.get("full_name"),
        "passenger_type": passenger_data.get("passenger_type", "Adult"),
        "id_number": passenger_data.get("id_number"),
        "date_of_birth": passenger_data.get("date_of_birth"),
        "phone_number": passenger_data.get("phone_number"),
        "email": passenger_data.get("email"),
        "nationality": passenger_data.get("nationality"),
        "notes": passenger_data.get("notes"),
        "is_active": passenger_data.get("is_active", 1),
    })
    passenger.insert()
    frappe.db.commit()
    
    return passenger

@frappe.whitelist(allow_guest=True)
def lookup_passenger_by_id(id_number):
    """Get passenger by ID number"""
    
    passengers = frappe.get_all("Passenger",
        filters={"id_number": id_number},
        fields=["name", "full_name", "passenger_type", "id_number", "phone_number", "email"]
    )
    
    return passengers[0] if passengers else None