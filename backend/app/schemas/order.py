from datetime import datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, Field, computed_field, field_serializer


class CheckoutRequest(BaseModel):
    address_id: int
    cart_id: int
    payment_method: Literal["razorpay", "cod"] = "razorpay"


class DirectCheckoutItem(BaseModel):
    product_id: int
    quantity: int
    selected_options: dict[str, str] | None = None


class DirectCheckoutRequest(BaseModel):
    address_id: int
    items: list[DirectCheckoutItem]
    payment_method: Literal["razorpay", "cod"] = "razorpay"


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
    product: Any = Field(default=None, exclude=True)

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def product_name(self) -> str | None:
        return self.product.name if getattr(self, "product", None) else None

    @field_serializer("resolved_image_url")
    def serialize_resolved_image_url(self, val: str | None) -> str | None:
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(val)


class OrderUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None = None

    model_config = {"from_attributes": True}


class OrderAddressResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    line1: str
    line2: str | None = None
    city: str
    state: str
    pincode: str

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: str
    total_amount: float
    payment_id: str | None
    payment_method: str = "razorpay"
    payment_status: str
    address_id: int
    created_at: datetime
    user: OrderUserResponse | None = None
    address: OrderAddressResponse | None = None
    items: list[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class CheckoutResponse(BaseModel):
    order_id: int
    razorpay_order_data: RazorpayOrderData | None = None


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    pages: int
