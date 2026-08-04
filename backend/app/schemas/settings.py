from datetime import datetime

from pydantic import BaseModel, Field


class StoreSettingsOut(BaseModel):
    id: int
    store_name: str
    support_email: str
    support_phone: str
    warehouse_address: str
    cod_enabled: bool
    free_shipping_threshold: int
    flat_shipping_rate: int
    notify_new_order: bool
    notify_low_stock: bool
    meta_title: str
    meta_description: str
    primary_color: str
    accent_color: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class StoreSettingsUpdate(BaseModel):
    store_name: str | None = Field(None, max_length=255)
    support_email: str | None = Field(None, max_length=255)
    support_phone: str | None = Field(None, max_length=50)
    warehouse_address: str | None = None
    cod_enabled: bool | None = None
    free_shipping_threshold: int | None = Field(None, ge=0)
    flat_shipping_rate: int | None = Field(None, ge=0)
    notify_new_order: bool | None = None
    notify_low_stock: bool | None = None
    meta_title: str | None = Field(None, max_length=255)
    meta_description: str | None = None
    primary_color: str | None = Field(None, max_length=20)
    accent_color: str | None = Field(None, max_length=20)
