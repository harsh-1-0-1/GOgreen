"""add category_badge_configs and drop per-product badge colours

The three badges drawn on a product image (bestseller, % OFF, rating) had their
colour stored on `products`, so renaming or recolouring a badge meant editing
every product. Wording, colour and on/off now live per category in this new
table, which is created empty — categories with no row keep the current look via
the client-side defaults.

The three legacy colour columns are dropped, so any colour set on a product in
the admin is discarded by this migration. `products.is_bestseller` is KEPT: it is
a per-product flag ("may this product wear the bestseller badge"), not styling.

Revision ID: m4n5o6p7q8r9
Revises: k3l4m5n6o7p8
Create Date: 2026-10-02 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m4n5o6p7q8r9"
down_revision: Union[str, Sequence[str], None] = "k3l4m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category_badge_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("bestseller_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("bestseller_label", sa.String(length=50), nullable=True),
        sa.Column("bestseller_color", sa.String(length=20), nullable=True),
        sa.Column("discount_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("discount_label", sa.String(length=50), nullable=True),
        sa.Column("discount_color", sa.String(length=20), nullable=True),
        sa.Column("rating_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("rating_label", sa.String(length=50), nullable=True),
        sa.Column("rating_color", sa.String(length=20), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name="fk_category_badge_configs_category",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", name="uq_category_badge_configs_category_id"),
    )
    op.create_index(
        "ix_category_badge_configs_id",
        "category_badge_configs",
        ["id"],
        unique=False,
    )

    op.drop_column("products", "bestseller_badge_color")
    op.drop_column("products", "discount_badge_color")
    op.drop_column("products", "rating_badge_color")


def downgrade() -> None:
    op.add_column("products", sa.Column("rating_badge_color", sa.String(length=20), nullable=True))
    op.add_column("products", sa.Column("discount_badge_color", sa.String(length=20), nullable=True))
    op.add_column("products", sa.Column("bestseller_badge_color", sa.String(length=20), nullable=True))

    op.drop_index("ix_category_badge_configs_id", table_name="category_badge_configs")
    op.drop_table("category_badge_configs")