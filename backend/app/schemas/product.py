from datetime import datetime
from typing import Optional, List
import uuid

from pydantic import BaseModel, Field, field_serializer, field_validator


class CareItem(BaseModel):
    """A single tile in the product care card (icon + title + description)."""
    icon: Optional[str] = None   # relative storage key, resolved to full URL in serializer
    title: str
    description: str


class VariantOption(BaseModel):
    """A single option within a variant group (e.g., '4 Inch' at ₹1499)."""
    id: str = Field(default_factory=lambda: f"opt_{uuid.uuid4().hex[:8]}")
    name: str = Field(min_length=1)
    price: float = Field(ge=0)
    stock: int = Field(ge=0, default=0)
    images: Optional[List[str]] = None  # relative keys, resolved to URLs in serializer
    color_hex: Optional[str] = None     # hex colour for colour-type variant swatches (e.g. "#ff0000")

    model_config = {"extra": "allow"}   # preserve any future fields without stripping them

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Option name cannot be empty")
        return v.strip()


class VariantGroup(BaseModel):
    """A variant type (e.g., 'Select Size' with options '4 Inch', '5 Inch')."""
    id: str = Field(default_factory=lambda: f"vg_{uuid.uuid4().hex[:8]}")
    label: str = Field(min_length=1)
    required: bool = True
    options: List[VariantOption] = Field(min_length=1)

    model_config = {"extra": "allow"}

    @field_validator("label")
    @classmethod
    def label_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Group label cannot be empty")
        return v.strip()

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[VariantOption]) -> List[VariantOption]:
        if not v:
            raise ValueError("Each variant group must have at least one option")
        # Check for duplicate option IDs
        option_ids = [opt.id for opt in v]
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("Duplicate option IDs within variant group")
        return v


class ProductVariantsNew(BaseModel):
    """New flexible variant structure - replaces old colors/pot_types/sizes."""
    variant_groups: List[VariantGroup] = []
    default_image: Optional[str] = None  # relative key, resolved to URL in serializer
    # Combo image map: keyed by "optId1__optId2__..." joining one optId per group in order.
    # Values are lists of relative image keys, resolved to URLs in the serializer.
    image_map: Optional[dict] = None

    model_config = {"extra": "allow"}


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float = Field(gt=0)
    original_price: float | None = None
    stock_qty: int = 0
    category_id: int
    tags: list[str] = []
    care_tips: list[str] = []
    how_to_guide: str | None = None
    sunlight: str | None = None
    watering: str | None = None
    care_items: Optional[List[CareItem]] = None
    badge: str | None = None
    is_active: bool = True
    variants: dict | None = None

    @field_validator("variants")
    @classmethod
    def validate_variants_structure(cls, v: dict | None) -> dict | None:
        return validate_variant_structure(v)


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    original_price: float | None = None
    stock_qty: int | None = None
    category_id: int | None = None
    images: list[str] | None = None
    tags: list[str] | None = None
    care_tips: list[str] | None = None
    how_to_guide: str | None = None
    sunlight: str | None = None
    watering: str | None = None
    care_items: Optional[List[CareItem]] = None
    badge: str | None = None
    is_active: bool | None = None
    # null  → field omitted from update (existing variants are preserved).
    # {}    → explicitly clear all variant data.
    # {...} → replace variants with the provided structure.
    variants: dict | None = None

    @field_validator("variants")
    @classmethod
    def validate_variants_structure(cls, v: dict | None) -> dict | None:
        return validate_variant_structure(v)


class ProductResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    price: float
    original_price: float | None
    stock_qty: int
    category_id: int
    images: list[str]
    tags: list[str]
    care_tips: list[str]
    how_to_guide: str | None
    sunlight: str | None
    watering: str | None
    care_items: Optional[List[dict]] = None   # dicts so the serializer can mutate icon keys
    badge: str | None
    is_active: bool
    created_at: datetime
    variants: dict | None = None
    # ⚠️ NOTE on variants field image storage:
    # Despite field names like "image_url", variants store RELATIVE KEYS in the database
    # (e.g. "plantoga/product-variants/42/abc.webp"), NOT full URLs.
    # The serializer below resolves them to full URLs in API responses.
    # Applies to: variants.default_image, variants.image_map[*], variants.pot_types[*].image_url

    model_config = {"from_attributes": True}

    @field_serializer("images")
    def serialize_images(self, images: list[str]) -> list[str]:
        from app.utils.image_upload import resolve_image_url
        return [resolve_image_url(img) for img in images] if images else []

    @field_serializer("care_items")
    def serialize_care_items(self, items: Optional[List[dict]]) -> Optional[List[dict]]:
        """Resolve each care item's icon key to a full CDN/static URL."""
        if not items:
            return None
        from app.utils.image_upload import resolve_image_url
        return [
            {**item, "icon": resolve_image_url(item["icon"]) if item.get("icon") else None}
            for item in items
        ]

    @field_serializer("variants")
    def serialize_variants(self, variants: dict | None) -> dict | None:
        from app.utils.image_upload import resolve_variants_images
        return resolve_variants_images(variants)


def validate_variant_structure(variants: dict | None) -> dict | None:
    """Validate and normalize variant structure (both old and new formats).
    
    Generates IDs for any groups/options that don't have them.
    Returns normalized structure or None.
    """
    if not variants:
        return None
    
    # Check if it's the new format
    if "variant_groups" in variants:
        try:
            # Validate using Pydantic model
            validated = ProductVariantsNew.model_validate(variants)
            return validated.model_dump()
        except Exception as e:
            raise ValueError(f"Invalid variant groups structure: {str(e)}")
    
    # Old format - still supported for now but should be migrated
    return variants


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    pages: int
    limit: int
