"""Add refunds table and partial_refund_amount

Revision ID: 322a87e1e369
Revises: 9ba56e49a4cf
Create Date: 2026-07-08 19:39:42.340417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '322a87e1e369'
down_revision: Union[str, Sequence[str], None] = '9ba56e49a4cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'refunds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('razorpay_refund_id', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('razorpay_refund_id', name='uq_refunds_razorpay_refund_id'),
    )
    with op.batch_alter_table('refunds', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_refunds_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_refunds_razorpay_refund_id'), ['razorpay_refund_id'], unique=True)

    # razorpay_order_id was already added in migration 9ba56e49a4cf — skip it
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partial_refund_amount', sa.Float(), nullable=False, server_default='0'))
        batch_op.alter_column(
            'payment_status',
            existing_type=sa.VARCHAR(length=8),
            type_=sa.Enum('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', name='paymentstatus'),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.alter_column(
            'payment_status',
            existing_type=sa.Enum('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', name='paymentstatus'),
            type_=sa.VARCHAR(length=8),
            existing_nullable=False,
        )
        batch_op.drop_column('partial_refund_amount')

    with op.batch_alter_table('refunds', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_refunds_razorpay_refund_id'))
        batch_op.drop_index(batch_op.f('ix_refunds_id'))

    op.drop_table('refunds')
