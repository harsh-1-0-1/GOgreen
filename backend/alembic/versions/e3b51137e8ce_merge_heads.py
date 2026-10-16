"""merge heads

Revision ID: e3b51137e8ce
Revises: 0ec1b62eac89, b4c5d6e7f8a0
Create Date: 2026-07-29 21:00:27.358911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3b51137e8ce'
down_revision: Union[str, Sequence[str], None] = ('0ec1b62eac89', 'b4c5d6e7f8a0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
