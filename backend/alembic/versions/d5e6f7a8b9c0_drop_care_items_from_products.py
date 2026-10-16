"""drop care_items column from products (no longer used)

Revision ID: d5e6f7a8b9c0
Revises: e3b51137e8ce
Create Date: 2026-07-29 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'e3b51137e8ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('care_items')


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('care_items', sa.JSON(), nullable=True)
        )
