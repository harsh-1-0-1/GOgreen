"""add_product_reviews

Revision ID: c8a2f6d9e104
Revises: 913c2e31893f
Create Date: 2026-06-12 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8a2f6d9e104'
down_revision: Union[str, Sequence[str], None] = '913c2e31893f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=140), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PUBLISHED', 'PENDING', 'REJECTED', name='reviewstatus'), nullable=False),
        sa.Column('is_verified_purchase', sa.Boolean(), nullable=False),
        sa.Column('helpful_count', sa.Integer(), nullable=False),
        sa.Column('reported_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'user_id', name='uq_product_reviews_product_user'),
    )
    op.create_index(op.f('ix_product_reviews_id'), 'product_reviews', ['id'], unique=False)
    op.create_index(op.f('ix_product_reviews_product_id'), 'product_reviews', ['product_id'], unique=False)
    op.create_index(op.f('ix_product_reviews_status'), 'product_reviews', ['status'], unique=False)
    op.create_index(op.f('ix_product_reviews_user_id'), 'product_reviews', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_product_reviews_user_id'), table_name='product_reviews')
    op.drop_index(op.f('ix_product_reviews_status'), table_name='product_reviews')
    op.drop_index(op.f('ix_product_reviews_product_id'), table_name='product_reviews')
    op.drop_index(op.f('ix_product_reviews_id'), table_name='product_reviews')
    op.drop_table('product_reviews')
    op.execute('DROP TYPE IF EXISTS reviewstatus')
