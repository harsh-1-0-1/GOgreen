"""add_store_settings_table

Revision ID: 88048ae8077c
Revises: f6a7b8c9d0e1
Create Date: 2026-08-04 18:25:05.738849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '88048ae8077c'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'store_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_name', sa.String(length=255), nullable=False, server_default='Plantoga'),
        sa.Column('support_email', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('support_phone', sa.String(length=50), nullable=False, server_default=''),
        sa.Column('warehouse_address', sa.Text(), nullable=False, server_default=''),
        sa.Column('cod_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('free_shipping_threshold', sa.Integer(), nullable=False, server_default='999'),
        sa.Column('flat_shipping_rate', sa.Integer(), nullable=False, server_default='75'),
        sa.Column('notify_new_order', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('notify_low_stock', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('meta_title', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('meta_description', sa.Text(), nullable=False, server_default=''),
        sa.Column('primary_color', sa.String(length=20), nullable=False, server_default='#2D6A4F'),
        sa.Column('accent_color', sa.String(length=20), nullable=False, server_default='#52B788'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('store_settings')
