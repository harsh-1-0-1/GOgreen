"""merge conflicting heads

Revision ID: 0ec1b62eac89
Revises: a3b4c5d6e7f8, ed9460317065
Create Date: 2026-07-29 20:51:00.079280

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ec1b62eac89'
down_revision: Union[str, Sequence[str], None] = ('a3b4c5d6e7f8', 'ed9460317065')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
