"""Pydantic schemas for corporate/bulk inquiries."""
import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class CorporateInquiryCreate(BaseModel):
    """Schema for creating a new corporate inquiry (public form submission)."""
    
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    email: EmailStr
    company_name: str = Field(..., min_length=2, max_length=255)
    customization_notes: str | None = Field(None, max_length=2000)
    qty_requested: int | None = Field(None, ge=10, le=100000)

    @field_validator("full_name", "company_name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        """Strip leading/trailing whitespace."""
        return v.strip()

    @field_validator("phone")
    @classmethod
    def validate_indian_phone(cls, v: str) -> str:
        """Validate Indian phone number format (matches frontend Zod regex)."""
        v = v.strip()
        # Regex matches: optional +91 prefix with optional space/dash, then 10-digit number starting with 6-9
        pattern = r"^(\+91[\s-]?)?[6-9]\d{9}$"
        if not re.match(pattern, v):
            raise ValueError("Please enter a valid Indian WhatsApp number")
        return v

    @field_validator("customization_notes")
    @classmethod
    def strip_notes(cls, v: str | None) -> str | None:
        """Strip whitespace from notes if present."""
        return v.strip() if v else None


class CorporateInquiryResponse(BaseModel):
    """Schema for corporate inquiry responses (public + admin)."""
    
    id: int
    ticket_id: str
    full_name: str
    phone: str
    email: str
    company_name: str
    customization_notes: str | None
    qty_requested: int | None
    is_duplicate: bool
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CorporateInquiryStatusUpdate(BaseModel):
    """Schema for updating inquiry status (admin only)."""
    
    status: str = Field(..., pattern="^(new|review|quoted|approved|cancelled)$")


class CorporateInquiryListResponse(BaseModel):
    """Schema for paginated list of corporate inquiries (admin)."""
    
    items: list[CorporateInquiryResponse]
    total: int
    page: int
    pages: int
