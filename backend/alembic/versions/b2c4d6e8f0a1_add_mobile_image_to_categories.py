"""Add mobile_image_url column to categories

Revision ID: b2c4d6e8f0a1
Revises: a9c0d1e2f3a4
Create Date: 2026-09-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c4d6e8f0a1"
down_revision: Union[str, Sequence[str], None] = "a9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add mobile_image_url column to categories."""
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("mobile_image_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    """Drop mobile_image_url column from categories."""
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_column("mobile_image_url")
