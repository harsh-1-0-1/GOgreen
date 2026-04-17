import hashlib

import pytest

from app.services.payu import generate_payu_hash, get_payu_form_data, verify_payu_hash

pytestmark = pytest.mark.asyncio


def test_generate_payu_hash():
    h = generate_payu_hash(
        key="gtKFFx", txnid="T6a7c7e09", amount="100.00",
        productinfo="iPhone", firstname="Ashish",
        email="test@gmail.com", salt="eCwWELxi",
    )
    expected_str = "gtKFFx|T6a7c7e09|100.00|iPhone|Ashish|test@gmail.com|||||||||||eCwWELxi"
    expected = hashlib.sha512(expected_str.encode()).hexdigest()
    assert h == expected


def test_verify_payu_hash():
    h = verify_payu_hash(
        key="gtKFFx", txnid="T6a7c7e09", amount="100.00",
        productinfo="iPhone", firstname="Ashish",
        email="test@gmail.com", status="success", salt="eCwWELxi",
    )
    expected_str = "eCwWELxi|success|||||||||||test@gmail.com|Ashish|iPhone|100.00|T6a7c7e09|gtKFFx"
    expected = hashlib.sha512(expected_str.encode()).hexdigest()
    assert h == expected


def test_hash_roundtrip():
    """Forward hash and reverse hash should produce different values."""
    fwd = generate_payu_hash(
        key="key1", txnid="txn1", amount="50.00",
        productinfo="prod", firstname="John",
        email="john@example.com", salt="salt1",
    )
    rev = verify_payu_hash(
        key="key1", txnid="txn1", amount="50.00",
        productinfo="prod", firstname="John",
        email="john@example.com", status="success", salt="salt1",
    )
    assert fwd != rev


def test_get_payu_form_data(monkeypatch):
    monkeypatch.setattr("app.services.payu.settings.PAYU_KEY", "testkey")
    monkeypatch.setattr("app.services.payu.settings.PAYU_SALT", "testsalt")

    data = get_payu_form_data(
        order_id=42, amount=999.00,
        firstname="Harsh", email="harsh@test.com", phone="9876543210",
    )
    assert data["txnid"] == "ORDER-42"
    assert data["amount"] == "999.00"
    assert data["key"] == "testkey"
    assert data["action"] == "https://test.payu.in/_payment"
    assert "hash" in data
