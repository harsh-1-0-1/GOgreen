from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, default=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=0)


class CartMergeRequest(BaseModel):
    session_id: str


class CartItemProduct(BaseModel):
    id: int
    name: str
    slug: str
    price: float
    original_price: float | None
    images: list[str]

    model_config = {"from_attributes": True}


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: CartItemProduct
    line_total: float

    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    id: int
    user_id: int | None
    session_id: str | None
    items: list[CartItemResponse] = []
    item_count: int
    subtotal: float
