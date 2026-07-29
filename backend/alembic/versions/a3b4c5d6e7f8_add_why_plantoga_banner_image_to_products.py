"""add_why_plantoga_banner_image_to_products

Revision ID: a3b4c5d6e7f8
Revises: e2f3a4b5c6d7
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('why_plantoga_banner_image', sa.String(512), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('why_plantoga_banner_image')
