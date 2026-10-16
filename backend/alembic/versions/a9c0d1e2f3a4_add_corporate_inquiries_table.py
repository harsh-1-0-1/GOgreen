"""Add corporate_inquiries table

Revision ID: a9c0d1e2f3a4
Revises: a7b8c9d0e1f2
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create corporate_inquiries table."""
    op.create_table(
        "corporate_inquiries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.String(length=20), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("customization_notes", sa.Text(), nullable=True),
        sa.Column("qty_requested", sa.Integer(), nullable=True),
        sa.Column("is_duplicate", sa.Boolean(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "new",
                "review",
                "quoted",
                "approved",
                "cancelled",
                name="corporateinquirystatus",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id", name="uq_corporate_inquiries_ticket_id"),
    )
    with op.batch_alter_table("corporate_inquiries", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_corporate_inquiries_id"), ["id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_corporate_inquiries_ticket_id"), ["ticket_id"], unique=True
        )
        batch_op.create_index(
            batch_op.f("ix_corporate_inquiries_status"), ["status"], unique=False
        )


def downgrade() -> None:
    """Drop corporate_inquiries table."""
    with op.batch_alter_table("corporate_inquiries", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_corporate_inquiries_status"))
        batch_op.drop_index(batch_op.f("ix_corporate_inquiries_ticket_id"))
        batch_op.drop_index(batch_op.f("ix_corporate_inquiries_id"))

    op.drop_table("corporate_inquiries")
    # Drop the enum type (PostgreSQL only — SQLite ignores this)
    op.execute("DROP TYPE IF EXISTS corporateinquirystatus")