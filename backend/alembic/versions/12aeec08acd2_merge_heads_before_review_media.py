"""merge_heads_before_review_media

Revision ID: 12aeec08acd2
Revises: 88048ae8077c, g8a9c0d1e2f3
Create Date: 2026-09-03 20:31:10.588155

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '12aeec08acd2'
down_revision: Union[str, Sequence[str], None] = ('88048ae8077c', 'g8a9c0d1e2f3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
