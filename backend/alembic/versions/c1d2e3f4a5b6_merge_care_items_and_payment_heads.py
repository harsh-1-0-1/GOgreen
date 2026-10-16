"""merge care_items and payment_method migration heads

Revision ID: c1d2e3f4a5b6
Revises: 5c6d7e8f9a0b, b1c2d3e4f5a6
Create Date: 2026-07-26 10:15:00.000000

"""
from typing import Sequence, Union


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = ("5c6d7e8f9a0b", "b1c2d3e4f5a6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge migration branches."""


def downgrade() -> None:
    """Unmerge migration branches."""
