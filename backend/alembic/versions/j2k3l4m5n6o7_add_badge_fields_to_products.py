"""add badge fields to products (is_bestseller, badge colours)

Revision ID: j2k3l4m5n6o7
Revises: e4f5a6b7c8d9
Create Date: 2026-10-02 00:00:00.000000

Adds four columns to the products table that let the admin control image
overlay badges (BESTSELLER label, % OFF label, star/rating badge) per product:
  - is_bestseller  : boolean, default false
  - bestseller_badge_color : hex colour string, nullable
  - discount_badge_color   : hex colour string, nullable
  - rating_badge_color     : hex colour string, nullable
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


revision: str = 'j2k3l4m5n6o7'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_bestseller', sa.Boolean(), nullable=False,
                      server_default=sa.text('false'))
        )
        batch_op.add_column(
            sa.Column('bestseller_badge_color', sa.String(length=20), nullable=True)
        )
        batch_op.add_column(
            sa.Column('discount_badge_color', sa.String(length=20), nullable=True)
        )
        batch_op.add_column(
            sa.Column('rating_badge_color', sa.String(length=20), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('rating_badge_color')
        batch_op.drop_column('discount_badge_color')
        batch_op.drop_column('bestseller_badge_color')
        batch_op.drop_column('is_bestseller')
