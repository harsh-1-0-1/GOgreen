"""add_target_path_to_banners

Revision ID: 88ec900b98a3
Revises: a2b3c4d5e6f7
Create Date: 2026-06-23 12:57:12.767157

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '88ec900b98a3'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('banners', sa.Column('target_path', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('banners', 'target_path')
