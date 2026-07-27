"""Add damage_claims table

Revision ID: e3f4a5b6c7d8
Revises: 322a87e1e369
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = "ed9460317065"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create damage_claims table."""
    op.create_table(
        "damage_claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("order_item_id", sa.Integer(), nullable=True),
        sa.Column("issue_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("photo_keys", sa.JSON(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "submitted",
                "under_review",
                "approved",
                "rejected",
                "replacement_shipped",
                "refund_issued",
                "closed",
                name="damageclaimstatus",
            ),
            nullable=False,
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id", name="uq_damage_claims_ticket_id"),
    )
    with op.batch_alter_table("damage_claims", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_damage_claims_id"), ["id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_damage_claims_ticket_id"), ["ticket_id"], unique=True
        )
        batch_op.create_index(
            batch_op.f("ix_damage_claims_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_damage_claims_order_id"), ["order_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_damage_claims_status"), ["status"], unique=False
        )


def downgrade() -> None:
    """Drop damage_claims table."""
    with op.batch_alter_table("damage_claims", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_damage_claims_status"))
        batch_op.drop_index(batch_op.f("ix_damage_claims_order_id"))
        batch_op.drop_index(batch_op.f("ix_damage_claims_user_id"))
        batch_op.drop_index(batch_op.f("ix_damage_claims_ticket_id"))
        batch_op.drop_index(batch_op.f("ix_damage_claims_id"))

    op.drop_table("damage_claims")
    # Drop the enum type (PostgreSQL only — SQLite ignores this)
    op.execute("DROP TYPE IF EXISTS damageclaimstatus")
