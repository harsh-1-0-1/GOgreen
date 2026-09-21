"""Make OrderItem self sufficient

Revision ID: 01ee7415dab8
Revises: b2c4d6e8f0a1
Create Date: 2026-09-21 14:03:03.591093

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '01ee7415dab8'
down_revision: Union[str, Sequence[str], None] = 'b2c4d6e8f0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_name_snapshot', sa.String(length=255), nullable=True))
        batch_op.alter_column('product_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.alter_column('product_id',
               existing_type=sa.INTEGER(),
               nullable=False)
        batch_op.drop_column('product_name_snapshot')
