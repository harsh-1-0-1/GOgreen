"""add related_product_ids JSON column to products (admin-curated 'You May Also Like')

Revision ID: a7b8c9d0e1f2
Revises: d1e2f3a4b5c6, f7a8b9c0d1e2
Create Date: 2026-09-04 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = ('d1e2f3a4b5c6', 'f7a8b9c0d1e2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('related_product_ids', sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('related_product_ids')
