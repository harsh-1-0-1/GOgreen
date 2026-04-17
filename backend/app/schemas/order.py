from datetime import datetime

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    address_id: int
    cart_id: int


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: str
    total_amount: float
    payment_id: str | None
    payment_status: str
    address_id: int
    created_at: datetime
    items: list[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class CheckoutResponse(BaseModel):
    order_id: int
    payu_form_data: dict


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    pages: int
