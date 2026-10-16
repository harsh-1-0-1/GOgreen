"""merge damage claims branch

Revision ID: 5a00ffafd9d2
Revises: e3f4a5b6c7d8, e6f7a8b9c0d1
Create Date: 2026-08-01 15:07:46.252064

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a00ffafd9d2'
down_revision: Union[str, Sequence[str], None] = ('e3f4a5b6c7d8', 'e6f7a8b9c0d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
