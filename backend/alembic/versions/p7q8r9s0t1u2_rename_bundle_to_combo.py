"""rename bundle fields to combo and add combo_items

Renames the bundle flag/summary to combo (is_combo / combo_description) and
adds combo_items, a structured list of the products that make up the combo.
Each item is {"name": str, "product_id": int | null} — name is a snapshot so
the storefront can render it without a lookup, product_id links back to the
catalog entry when the item was picked from it (null for custom names).

Revision ID: p7q8r9s0t1u2
Revises: o6p7q8r9s0t1
Create Date: 2026-10-15 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p7q8r9s0t1u2"
down_revision: Union[str, Sequence[str], None] = "o6p7q8r9s0t1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # alter_column rename preserves existing data — the one product already
    # flagged as a bundle becomes a combo without any backfill.
    op.alter_column("products", "is_bundle", new_column_name="is_combo")
    op.alter_column("products", "bundle_description", new_column_name="combo_description")
    # combo_items is NULL for non-combos (and for combos not yet itemised);
    # the free-text combo_description is kept as an optional summary.
    op.add_column("products", sa.Column("combo_items", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "combo_items")
    op.alter_column("products", "combo_description", new_column_name="bundle_description")
    op.alter_column("products", "is_combo", new_column_name="is_bundle")
