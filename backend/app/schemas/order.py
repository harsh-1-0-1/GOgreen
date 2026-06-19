from datetime import datetime

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    address_id: int
    cart_id: int


class DirectCheckoutItem(BaseModel):
    product_id: int
    quantity: int
    selected_options: dict[str, str] | None = None


class DirectCheckoutRequest(BaseModel):
    address_id: int
    items: list[DirectCheckoutItem]


class RazorpayOrderData(BaseModel):
    key_id: str
    order_id: str | None = None
    amount: int
    currency: str = "INR"
    name: str = "Plantoga"
    description: str
    prefill: dict[str, str]
    notes: dict[str, str]


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    selected_options: dict[str, str] | None = None
    resolved_image_url: str | None = None

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
    payu_form_data: dict | None = None
    razorpay_order_data: RazorpayOrderData | None = None


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    pages: int
