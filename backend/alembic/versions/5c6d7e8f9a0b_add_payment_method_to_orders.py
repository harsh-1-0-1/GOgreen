"""Add payment_method to orders

Revision ID: 5c6d7e8f9a0b
Revises: 322a87e1e369
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c6d7e8f9a0b"
down_revision: Union[str, Sequence[str], None] = "322a87e1e369"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("payment_method", sa.String(length=30), nullable=False, server_default="razorpay")
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.drop_column("payment_method")
