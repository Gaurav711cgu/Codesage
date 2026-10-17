"""
Unit tests for AST-Aware Signature Pruning and Context Token Budgeting.
"""
import pytest

from app.services.ast_pruner import prune_to_signature, budget_context_chunks


def test_prune_to_signature_long_function():
    source = """def process_payments(account_id: str, amount_cents: int, currency: str = "USD") -> bool:
    # Validate account
    if not account_id:
        raise ValueError("Invalid account")
    client = get_stripe_client()
    charge = client.charges.create(amount=amount_cents, currency=currency)
    log_transaction(account_id, charge.id)
    send_receipt_email(account_id, amount_cents)
    update_account_balance(account_id, amount_cents)
    return True"""

    pruned = prune_to_signature(source, docstring="Authorize and charge credit card.")
    assert "def process_payments" in pruned
    assert "currency: str = \"USD\") -> bool:" in pruned
    assert '"""Authorize and charge credit card."""' in pruned
    assert "..." in pruned
    assert "Implementation pruned" in pruned
    assert "get_stripe_client" not in pruned


def test_prune_to_signature_short_function():
    source = "def add(a, b):\n    return a + b"
    pruned = prune_to_signature(source)
    assert pruned == source  # Kept intact


def test_budget_context_chunks():
    chunks = [
        {
            "id": "seed_1",
            "type": "seed",
            "content": "def main():\n" + "    print('step')\n" * 10,
            "docstring": "Entrypoint",
        },
        {
            "id": "neighbor_1",
            "type": "neighbor",
            "content": "def helper(x: int) -> int:\n" + "    x = x + 1\n" * 15 + "    return x",
            "docstring": "Increment value",
        },
    ]

    budgeted = budget_context_chunks(chunks, max_total_tokens=500)
    assert len(budgeted) == 2
    assert budgeted[0]["pruned"] is False
    assert budgeted[1]["pruned"] is True
    assert "Implementation pruned" in budgeted[1]["content"]
