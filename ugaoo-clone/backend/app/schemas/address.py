from pydantic import BaseModel


class AddressCreate(BaseModel):
    full_name: str
    phone: str
    line1: str
    line2: str | None = None
    city: str
    state: str
    pincode: str
    is_default: bool = False


class AddressUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    line1: str | None = None
    line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    is_default: bool | None = None


class AddressResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    phone: str
    line1: str
    line2: str | None
    city: str
    state: str
    pincode: str
    is_default: bool

    model_config = {"from_attributes": True}
