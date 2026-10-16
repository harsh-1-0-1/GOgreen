"""add_coupons_and_order_discount

Revision ID: c7f2a1b9d4e5
Revises: i1b2c3d4e5f6
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f2a1b9d4e5'
down_revision: Union[str, Sequence[str], None] = 'i1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'coupons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('type', sa.Enum('percent', 'fixed', name='coupontype'), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('min_amount', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('times_used', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_coupons_code'), 'coupons', ['code'], unique=True)
    op.create_index(op.f('ix_coupons_id'), 'coupons', ['id'], unique=False)

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('coupon_code', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('coupon_discount', sa.Float(), nullable=False, server_default='0.0'))

    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('coupon_discount')
        batch_op.drop_column('coupon_code')

    op.drop_index(op.f('ix_coupons_id'), table_name='coupons')
    op.drop_index(op.f('ix_coupons_code'), table_name='coupons')
    op.drop_table('coupons')
    sa.Enum(name='coupontype').drop(op.get_bind(), checkfirst=True)

    # ### end Alembic commands ###