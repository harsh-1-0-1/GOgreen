from datetime import datetime
from typing import Dict, Optional, List
import uuid

from pydantic import BaseModel, Field, field_serializer, field_validator, model_validator

# Joiner shared by every variant key space: image_map, stock_map, price_map, pot_price.map.
# Kept in one place because the storefront has an identical constant and the two key spaces
# must never be interchanged.
COMBO_KEY_SEP = "__"


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
    # When true, the storefront renders EVERY defined option in this group regardless
    # of per-combination stock (e.g. always show Small/Medium/Large); colour groups
    # without this flag keep hiding out-of-stock options. Independent of `required`.
    always_show_options: bool = False
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


class PotPrice(BaseModel):
    """Component price grid over a SUBSET of the product's variant groups.

    Distinct from `price_map`, which is an ABSOLUTE total per FULL combination. Values here are
    ADDENDS, and the keys are shorter — one option id per `group_ids` entry, joined by
    COMBO_KEY_SEP — because they live in a different key space. A `price_map` key can never
    resolve here and must never be written into `map`.
    """
    # The groups this grid prices, in canonical product-group order. Their options' own
    # `price` deltas are EXCLUDED from the additive total, because the grid already prices
    # them — that exclusion is the whole point, and misconfiguring it double-charges.
    group_ids: List[str] = Field(min_length=1)
    # Groups NOT in `group_ids` that the admin has declared as separate charges, so their
    # deltas are added normally. A priced group left undeclared is a 422, not a warning.
    independent_group_ids: List[str] = Field(default_factory=list)
    # Sparse: absent = unknown, and the resolver falls through rather than assuming zero.
    map: Dict[str, float] = Field(default_factory=dict)

    model_config = {"extra": "allow"}

    @field_validator("map")
    @classmethod
    def validate_map(cls, v: Dict[str, float]) -> Dict[str, float]:
        for key, val in v.items():
            if val < 0:
                raise ValueError(f"Price for '{key}' cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_key_space(self) -> "PotPrice":
        """Cross-field checks the `map` validator cannot do on its own.

        Key arity is the important one. `map` keys are a DIFFERENT key space from `price_map`:
        one option id per `group_ids` entry, not one per product group. A 3-segment key here
        (a `price_map` key, copied over by mistake) can never resolve, so every affected cell
        would silently bill as unpriced. Catching it at save is the only place it is visible.
        """
        if len(set(self.group_ids)) != len(self.group_ids):
            dupes = sorted({g for g in self.group_ids if self.group_ids.count(g) > 1})
            raise ValueError(f"Duplicate group in group_ids: {', '.join(dupes)}")

        overlap = [g for g in self.independent_group_ids if g in self.group_ids]
        if overlap:
            # A group cannot be both excluded from the delta sum and included in it. The
            # second declaration is what an admin means by "also charge this", so honouring
            # it would double-charge every order.
            raise ValueError(
                "independent_group_ids must not overlap group_ids: "
                + ", ".join(sorted(overlap))
            )

        expected = len(self.group_ids)
        for key in self.map:
            parts = key.split(COMBO_KEY_SEP)
            if len(parts) != expected:
                raise ValueError(
                    f"Price key '{key}' has {len(parts)} segments but this grid prices "
                    f"{expected} group(s); keys must be "
                    + COMBO_KEY_SEP.join(f"<{g}>" for g in self.group_ids)
                )
            if any(not p for p in parts):
                raise ValueError(f"Price key '{key}' has an empty segment")
        return self

    def axis_count(self) -> int:
        return len(self.group_ids)


class ProductVariantsNew(BaseModel):
    """New flexible variant structure - replaces old colors/pot_types/sizes."""
    variant_groups: List[VariantGroup] = []
    default_image: Optional[str] = None  # relative key, resolved to URL in serializer
    # Combo image map: keyed by "optId1__optId2__..." joining one optId per group in order.
    # Values are lists of relative image keys, resolved to URLs in the serializer.
    image_map: Optional[dict] = None
    # Per-combination stock map (dense): keyed by the same "optId1__optId2__..." combo
    # key, one row for EVERY cartesian combination (including 0). This is the source of
    # truth for availability/reservation on variant_groups products; options[].stock is
    # retained only as the migration source. See VARIANT_COMBO_STOCK_PLAN.md.
    stock_map: Optional[dict] = None
    # Per-combination price map (dense): keyed by the same combo key. When a row exists,
    # it wins over the per-option sum (which the admin table seeds as the editable
    # default), allowing each combination to carry its own price (e.g. Small/Krish ₹300
    # vs Medium/Krish ₹350). Absent rows fall back to summing option prices.
    price_map: Optional[dict] = None
    # Component price grid (e.g. pot price across size × pot style). N-axis: `group_ids` is
    # admin-selected and the key order follows the product's own variant_groups order, so
    # reordering the admin pickers cannot silently rewrite the map. See PotPrice.
    pot_price: Optional[PotPrice] = None

    model_config = {"extra": "allow"}


class FAQItem(BaseModel):
    """A single FAQ entry."""
    question: str
    answer: str


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
    display_section: str | None = None
    is_active: bool = True
    variants: dict | None = None
    promise_banner_image: str | None = None  # relative storage key
    why_plantoga_banner_image: str | None = None  # relative storage key
    care_card_image: str | None = None  # relative storage key
    faqs: Optional[List[FAQItem]] = None
    related_product_ids: Optional[List[int]] = None

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
    display_section: str | None = None
    is_active: bool | None = None
    # null  → field omitted from update (existing variants are preserved).
    # {}    → explicitly clear all variant data.
    # {...} → replace variants with the provided structure.
    variants: dict | None = None
    promise_banner_image: str | None = None  # relative key; null clears, omit to preserve
    why_plantoga_banner_image: str | None = None  # relative key; null clears, omit to preserve
    care_card_image: str | None = None  # relative key; null clears, omit to preserve
    faqs: Optional[List[FAQItem]] = None
    related_product_ids: Optional[List[int]] = None

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
    display_section: str | None = None
    is_active: bool
    created_at: datetime
    variants: dict | None = None
    promise_banner_image: str | None = None
    why_plantoga_banner_image: str | None = None
    care_card_image: str | None = None
    faqs: Optional[List[dict]] = None
    related_product_ids: Optional[List[int]] = None
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

    @field_serializer("promise_banner_image")
    def serialize_promise_banner_image(self, key: str | None) -> str | None:
        """Resolve relative storage key to full CDN/static URL."""
        if not key:
            return None
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(key)

    @field_serializer("why_plantoga_banner_image")
    def serialize_why_plantoga_banner_image(self, key: str | None) -> str | None:
        """Resolve relative storage key to full CDN/static URL."""
        if not key:
            return None
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(key)

    @field_serializer("care_card_image")
    def serialize_care_card_image(self, key: str | None) -> str | None:
        """Resolve relative storage key to full CDN/static URL."""
        if not key:
            return None
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(key)

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
