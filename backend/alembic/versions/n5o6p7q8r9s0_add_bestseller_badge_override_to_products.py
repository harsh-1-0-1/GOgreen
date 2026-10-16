"""add per-product bestseller badge wording/colour overrides

The bestseller badge's wording and colour are configured per category
(`category_badge_configs`). That makes renaming a badge for a whole category easy
but renaming it for ONE product impossible — the only per-product field was the
`is_bestseller` flag ("may this product wear the badge"), not its appearance.

These two nullable columns are that missing per-product layer. NULL means "not
overridden", so the category config still decides, and the two columns are
independent (rename without recolouring, or vice versa). Created with no
backfill: every existing product keeps rendering exactly as it does today.

Revision ID: n5o6p7q8r9s0
Revises: m4n5o6p7q8r9
Create Date: 2026-10-06 10:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n5o6p7q8r9s0"
down_revision: Union[str, Sequence[str], None] = "m4n5o6p7q8r9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable with no server_default on purpose: NULL is the "follow the
    # category config" state, and existing rows must be left untouched rather
    # than backfilled with a copy of the category wording.
    op.add_column(
        "products",
        sa.Column("bestseller_label_override", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("bestseller_color_override", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "bestseller_color_override")
    op.drop_column("products", "bestseller_label_override")
