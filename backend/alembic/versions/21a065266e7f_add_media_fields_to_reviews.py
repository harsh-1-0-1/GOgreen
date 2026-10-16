"""add_media_fields_to_reviews

Revision ID: 21a065266e7f
Revises: 12aeec08acd2
Create Date: 2026-09-03 20:31:21.030418

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21a065266e7f'
down_revision: Union[str, Sequence[str], None] = '12aeec08acd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('product_reviews', sa.Column('media_url', sa.String(length=512), nullable=True))
    op.add_column('product_reviews', sa.Column('youtube_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('product_reviews', 'youtube_url')
    op.drop_column('product_reviews', 'media_url')
