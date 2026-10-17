"""
Sample Microservice API entrypoint.
"""
from typing import Dict, Any
from .service import verify_jwt_signature, generate_invoice, compute_tax

def get_user_profile(user_id: str, token: str) -> Dict[str, Any]:
    """Retrieve user profile after verifying auth token."""
    claims = verify_jwt_signature(token)
    if not claims:
        raise PermissionError("Invalid token")
    return {"user_id": user_id, "email": claims.get("email")}

def calculate_billing(order_items: list[dict], user_id: str) -> Dict[str, Any]:
    """Calculate billing summary with tax and invoice generation."""
    tax = compute_tax(order_items)
    invoice = generate_invoice(order_items, tax, user_id)
    return invoice
