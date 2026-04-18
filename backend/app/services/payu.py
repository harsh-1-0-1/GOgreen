import hashlib

from loguru import logger

from app.core.config import settings

PAYU_TEST_URL = "https://test.payu.in/_payment"
PAYU_PROD_URL = "https://secure.payu.in/_payment"


def generate_payu_hash(
    key: str, txnid: str, amount: str, productinfo: str,
    firstname: str, email: str, salt: str,
    udf1: str = "", udf2: str = "", udf3: str = "",
    udf4: str = "", udf5: str = "",
) -> str:
    """key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt"""
    hash_string = f"{key}|{txnid}|{amount}|{productinfo}|{firstname}|{email}|{udf1}|{udf2}|{udf3}|{udf4}|{udf5}||||||{salt}"
    return hashlib.sha512(hash_string.encode()).hexdigest()


def verify_payu_hash(
    key: str, txnid: str, amount: str, productinfo: str,
    firstname: str, email: str, status: str, salt: str,
    udf1: str = "", udf2: str = "", udf3: str = "",
    udf4: str = "", udf5: str = "",
    additional_charges: str = "",
) -> str:
    """Reverse hash: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key"""
    if additional_charges:
        hash_string = (
            f"{additional_charges}|{salt}|{status}||||||"
            f"{udf5}|{udf4}|{udf3}|{udf2}|{udf1}|{email}|"
            f"{firstname}|{productinfo}|{amount}|{txnid}|{key}"
        )
    else:
        hash_string = (
            f"{salt}|{status}||||||"
            f"{udf5}|{udf4}|{udf3}|{udf2}|{udf1}|{email}|"
            f"{firstname}|{productinfo}|{amount}|{txnid}|{key}"
        )
    return hashlib.sha512(hash_string.encode()).hexdigest()


def get_payu_form_data(
    order_id: int, amount: float, firstname: str, email: str,
    phone: str, productinfo: str = "Plantoga Order",
) -> dict:
    key = settings.PAYU_KEY
    salt = settings.PAYU_SALT
    txnid = f"ORDER-{order_id}"
    amount_str = f"{amount:.2f}"

    payu_hash = generate_payu_hash(
        key=key, txnid=txnid, amount=amount_str,
        productinfo=productinfo, firstname=firstname,
        email=email, salt=salt,
    )

    base_url = "http://localhost:8000"
    form_data = {
        "action": PAYU_TEST_URL,
        "key": key,
        "txnid": txnid,
        "amount": amount_str,
        "productinfo": productinfo,
        "firstname": firstname,
        "email": email,
        "phone": phone,
        "surl": f"{base_url}/api/v1/payments/payu/success",
        "furl": f"{base_url}/api/v1/payments/payu/failure",
        "hash": payu_hash,
    }

    logger.info("PayU form data generated for order_id={} txnid={}", order_id, txnid)
    return form_data
