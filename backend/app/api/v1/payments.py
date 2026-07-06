from fastapi import APIRouter, Depends, Form, HTTPException
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.services import order_service
from app.services.payu import verify_payu_hash

router = APIRouter(prefix="/payments", tags=["payments"])


async def _handle_payu_response(
    db: AsyncSession,
    status: str,
    txnid: str,
    amount: str,
    productinfo: str,
    firstname: str,
    email: str,
    mihpayid: str,
    payu_hash: str,
    udf1: str = "",
    udf2: str = "",
    udf3: str = "",
    udf4: str = "",
    udf5: str = "",
    additional_charges: str = "",
) -> dict:
    expected_hash = verify_payu_hash(
        key=settings.PAYU_KEY, txnid=txnid, amount=amount,
        productinfo=productinfo, firstname=firstname, email=email,
        status=status, salt=settings.PAYU_SALT,
        udf1=udf1, udf2=udf2, udf3=udf3, udf4=udf4, udf5=udf5,
        additional_charges=additional_charges,
    )

    if expected_hash != payu_hash:
        logger.warning("PayU hash mismatch for txnid={}: expected={} got={}", txnid, expected_hash, payu_hash)
        raise HTTPException(status_code=400, detail="Hash verification failed")

    # txnid is "ORDER-{id}"
    try:
        order_id = int(txnid.split("-", 1)[1])
    except (IndexError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid txnid format") from exc

    logger.info("PayU webhook: txnid={} status={} mihpayid={}", txnid, status, mihpayid)

    if status.lower() == "success":
        order = await order_service.mark_paid(db, order_id, mihpayid)
    else:
        order = await order_service.mark_failed(db, order_id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {"status": "ok", "order_id": order_id, "payment_status": order.payment_status.value}


@router.post("/payu/webhook")
@limiter.exempt
async def payu_webhook(
    status: str = Form(...),
    txnid: str = Form(...),
    amount: str = Form(...),
    productinfo: str = Form(...),
    firstname: str = Form(...),
    email: str = Form(...),
    mihpayid: str = Form(""),
    hash: str = Form(..., alias="hash"),
    udf1: str = Form(""),
    udf2: str = Form(""),
    udf3: str = Form(""),
    udf4: str = Form(""),
    udf5: str = Form(""),
    additional_charges: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_payu_response(
        db, status=status, txnid=txnid, amount=amount,
        productinfo=productinfo, firstname=firstname, email=email,
        mihpayid=mihpayid, payu_hash=hash,
        udf1=udf1, udf2=udf2, udf3=udf3, udf4=udf4, udf5=udf5,
        additional_charges=additional_charges,
    )


@router.post("/payu/success")
@limiter.exempt
async def payu_success(
    status: str = Form(...),
    txnid: str = Form(...),
    amount: str = Form(...),
    productinfo: str = Form(...),
    firstname: str = Form(...),
    email: str = Form(...),
    mihpayid: str = Form(""),
    hash: str = Form(..., alias="hash"),
    udf1: str = Form(""),
    udf2: str = Form(""),
    udf3: str = Form(""),
    udf4: str = Form(""),
    udf5: str = Form(""),
    additional_charges: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_payu_response(
        db, status=status, txnid=txnid, amount=amount,
        productinfo=productinfo, firstname=firstname, email=email,
        mihpayid=mihpayid, payu_hash=hash,
        udf1=udf1, udf2=udf2, udf3=udf3, udf4=udf4, udf5=udf5,
        additional_charges=additional_charges,
    )


@router.post("/payu/failure")
@limiter.exempt
async def payu_failure(
    status: str = Form(...),
    txnid: str = Form(...),
    amount: str = Form(...),
    productinfo: str = Form(...),
    firstname: str = Form(...),
    email: str = Form(...),
    mihpayid: str = Form(""),
    hash: str = Form(..., alias="hash"),
    udf1: str = Form(""),
    udf2: str = Form(""),
    udf3: str = Form(""),
    udf4: str = Form(""),
    udf5: str = Form(""),
    additional_charges: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_payu_response(
        db, status=status, txnid=txnid, amount=amount,
        productinfo=productinfo, firstname=firstname, email=email,
        mihpayid=mihpayid, payu_hash=hash,
        udf1=udf1, udf2=udf2, udf3=udf3, udf4=udf4, udf5=udf5,
        additional_charges=additional_charges,
    )
