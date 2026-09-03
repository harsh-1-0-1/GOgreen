"""add display_section field to products for home page display control

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-09-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('display_section', sa.String(50), nullable=True)
        )
        batch_op.create_index('ix_products_display_section', ['display_section'])


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_index('ix_products_display_section')
        batch_op.drop_column('display_section')

