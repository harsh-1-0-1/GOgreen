"""add_sort_order_to_categories

Revision ID: f6a7b8c9d0e1
Revises: 5a00ffafd9d2
Create Date: 2026-08-04 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "5a00ffafd9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "sort_order", sa.Integer(), nullable=False, server_default="0"
            )
        )

    # Backfill so the CURRENT creation order is preserved on deploy
    # (a plain 0 backfill would tie everything and reshuffle to
    # (sort_order, name) ordering).
    op.execute(
        """
        UPDATE categories
        SET sort_order = ordered.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
            FROM categories
        ) ordered
        WHERE categories.id = ordered.id
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_column("sort_order")
