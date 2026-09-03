"""add banner_image_url to categories

Revision ID: a9c1e3f5b2d4
Revises: 88048ae8077c
Create Date: 2026-09-03 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a9c1e3f5b2d4'
down_revision = '88048ae8077c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'categories',
        sa.Column('banner_image_url', sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('categories', 'banner_image_url')
