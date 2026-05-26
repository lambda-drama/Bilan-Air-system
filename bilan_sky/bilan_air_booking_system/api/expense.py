# bilan_air/api/expense.py

import frappe

@frappe.whitelist()
def create_expense_category(category_name, category_group):
    """Create a new expense type"""
    
    expense_type = frappe.get_doc({
        "doctype": "Air Expense Type",
        "expense_type_name": category_name,
        "category": category_group,
        "is_active": 1
    })
    expense_type.insert()
    frappe.db.commit()
    
    return expense_type

@frappe.whitelist()
def record_expense(expense_type, amount, airplane=None, flight_schedule=None, description=None):
    """Add an expense record"""
    
    expense = frappe.get_doc({
        "doctype": "Air Expense Tracking",
        "expense_type": expense_type,
        "airplane": airplane,
        "flight_schedule": flight_schedule,
        "amount": amount,
        "description": description,
        "expense_date": frappe.utils.nowdate()
    })
    expense.insert()
    frappe.db.commit()
    
    return expense

@frappe.whitelist()
def fetch_expenses_by_flight(flight_schedule_name):
    """Get all expenses for a flight"""
    
    return frappe.get_all("Air Expense Tracking",
        filters={"flight_schedule": flight_schedule_name},
        fields=["expense_type", "amount", "description", "expense_date"]
    )