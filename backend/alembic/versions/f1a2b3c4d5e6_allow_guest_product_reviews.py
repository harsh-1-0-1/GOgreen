"""allow_guest_product_reviews

Revision ID: f1a2b3c4d5e6
Revises: c8a2f6d9e104
Create Date: 2026-06-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'c8a2f6d9e104'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product_reviews', sa.Column('guest_name', sa.String(length=255), nullable=True))
    op.alter_column('product_reviews', 'user_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM product_reviews WHERE user_id IS NULL")
    op.alter_column('product_reviews', 'user_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('product_reviews', 'guest_name')
