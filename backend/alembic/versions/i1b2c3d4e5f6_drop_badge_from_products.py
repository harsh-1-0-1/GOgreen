"""drop badge and badge_color from products (replaced by catalog tags)

Revision ID: i1b2c3d4e5f6
Revises: h2a3b4c5d6e7
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


revision: str = 'i1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'h2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('badge_color')
        batch_op.drop_column('badge')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('badge', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('badge_color', sa.String(length=50), nullable=True))