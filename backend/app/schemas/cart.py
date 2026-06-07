from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, default=1)
    selected_options: dict[str, str] | None = None


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
    variants: dict | None = None

    model_config = {"from_attributes": True}


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    selected_options: dict[str, str] | None = None
    product: CartItemProduct
    line_total: float
    resolved_image_url: str
    unit_price: float
    available_stock: int
    stock_warning: bool

    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    id: int
    user_id: int | None
    session_id: str | None
    items: list[CartItemResponse] = []
    item_count: int
    subtotal: float
