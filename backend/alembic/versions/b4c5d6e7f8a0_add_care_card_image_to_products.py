"""add_care_card_image_to_products

Revision ID: b4c5d6e7f8a0
Revises: a3b4c5d6e7f8
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4c5d6e7f8a0'
down_revision: Union[str, Sequence[str], None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('care_card_image', sa.String(512), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('care_card_image')
