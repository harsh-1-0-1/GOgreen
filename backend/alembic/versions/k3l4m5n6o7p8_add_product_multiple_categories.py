"""add product_categories so products can sit in multiple categories

Products keep their existing NOT NULL `products.category_id` as the PRIMARY category;
this table records the ADDITIONAL ones. No backfill is needed — the primary is
still discoverable through the column.

Revision ID: k3l4m5n6o7p8
Revises: j2k3l4m5n6o7
Create Date: 2026-10-02 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k3l4m5n6o7p8"
down_revision: Union[str, Sequence[str], None] = "j2k3l4m5n6o7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_categories",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        # Composite PK is the duplicate guard: the same product cannot be linked to
        # the same category twice, which is what makes the ORM collection a set.
        sa.PrimaryKeyConstraint("product_id", "category_id"),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], ondelete="CASCADE"
        ),
    )
    # Catalog filtering always asks "which products are in this category", so the
    # index leads with category_id.
    op.create_index(
        "ix_product_categories_category_id", "product_categories", ["category_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_product_categories_category_id", table_name="product_categories")
    op.drop_table("product_categories")