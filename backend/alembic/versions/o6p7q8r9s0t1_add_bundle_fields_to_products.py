"""add is_bundle and bundle_description to products

Marks a product as a bundle of multiple items. When true, the storefront
shows "About the Bundle" instead of "Product Specification" and renders
the bundle_description (contents / summary) in that section.

Revision ID: o6p7q8r9s0t1
Revises: n5o6p7q8r9s0
Create Date: 2026-10-14 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o6p7q8r9s0t1"
down_revision: Union[str, Sequence[str], None] = "n5o6p7q8r9s0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # is_bundle defaults to false server-side so every existing product stays
    # a regular product without any data backfill.
    op.add_column(
        "products",
        sa.Column(
            "is_bundle",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # bundle_description is free text; NULL means "not set" (not a bundle, or
    # description not yet written).
    op.add_column(
        "products",
        sa.Column("bundle_description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "bundle_description")
    op.drop_column("products", "is_bundle")
