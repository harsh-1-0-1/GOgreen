from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

HEX_RE = r"^#[0-9A-Fa-f]{6}$"


class BadgeStyle(BaseModel):
    """One badge's appearance for a category."""

    enabled: bool = True
    # Empty string means "keep the automatic wording" (e.g. "40% OFF", the rating
    # score). Only the bestseller badge ships with a fixed default word.
    label: str = Field(default="", max_length=50)
    color: str = Field(default="#1B4332", pattern=HEX_RE)

    @field_validator("label")
    @classmethod
    def strip_label(cls, v: str) -> str:
        return v.strip()


class CategoryBadgeConfigBase(BaseModel):
    bestseller: BadgeStyle = Field(
        default_factory=lambda: BadgeStyle(label="BESTSELLER", color="#F59E0B")
    )
    discount: BadgeStyle = Field(
        default_factory=lambda: BadgeStyle(color="#1B4332")
    )
    rating: BadgeStyle = Field(
        default_factory=lambda: BadgeStyle(color="#1B4332")
    )


class CategoryBadgeConfigUpdate(CategoryBadgeConfigBase):
    pass


class CategoryBadgeConfigOut(CategoryBadgeConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    updated_at: Optional[datetime] = None


class BadgeEligibility(BaseModel):
    """How many products in a category would actually show each badge.

    Lets the admin see, before saving, that a badge they just coloured will never
    appear because nothing in the category qualifies for it.
    """

    total: int
    bestseller: int
    discount: int
    rating: int


class BadgeConfigMap(BaseModel):
    """Everything the storefront needs in one request.

    `by_category` holds only the rows an admin has actually saved (the admin UI
    needs to know which categories are customised).

    `effective_by_category` holds the RESOLVED config for every category,
    including inherited ones: most products live in a subcategory, so a config
    saved on "Plants" has to reach "Indoor Plants". Resolving it here keeps the
    storefront from having to walk the category tree itself.
    """

    defaults: CategoryBadgeConfigBase
    by_category: dict[str, CategoryBadgeConfigOut] = Field(default_factory=dict)
    effective_by_category: dict[str, CategoryBadgeConfigBase] = Field(default_factory=dict)