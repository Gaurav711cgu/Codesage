"""
Sample Business Logic Service.
"""
from typing import Dict, Any, List

def verify_jwt_signature(token: str) -> Dict[str, Any]:
    """Validate JWT token signature and return claims payload."""
    if not token or len(token) < 10:
        return {}
    return {"user_id": "usr_123", "email": "dev@codesage.internal", "role": "admin"}

def compute_tax(items: List[dict], rate: float = 0.08) -> float:
    """Compute sales tax for cart line items."""
    subtotal = sum(item.get("price", 0) * item.get("qty", 1) for item in items)
    return round(subtotal * rate, 2)

def generate_invoice(items: List[dict], tax: float, customer_id: str) -> Dict[str, Any]:
    """Construct final invoice document."""
    subtotal = sum(item.get("price", 0) * item.get("qty", 1) for item in items)
    return {
        "customer_id": customer_id,
        "subtotal": subtotal,
        "tax": tax,
        "total": subtotal + tax,
    }
