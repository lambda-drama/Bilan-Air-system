# bilan_air/api/crew.py

import frappe

@frappe.whitelist(allow_guest=True)
def fetch_crew_roles():
    """Get all crew roles"""
    
    return frappe.get_all("Crew Role",
        filters={"is_active": 1},
        fields=["name", "role_name", "category", "requires_license"]
    )

@frappe.whitelist()
def fetch_available_crew_members(role, date):
    """Get available crew members for a date"""
    
    assigned = frappe.get_all("Flight Schedule",
        filters={"departure_date": date},
        fields=["captain", "first_officer"]
    )
    
    assigned_names = []
    for flight in assigned:
        if flight.captain:
            assigned_names.append(flight.captain)
        if flight.first_officer:
            assigned_names.append(flight.first_officer)
    
    return frappe.get_all("Crew Member",
        filters={
            "crew_role": role,
            "status": "Active",
            "name": ["not in", assigned_names]
        },
        fields=["name", "full_name", "employee_id", "base_airport"]
    )