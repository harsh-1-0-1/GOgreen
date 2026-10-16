"""create display sections and seed product section values

Revision ID: d8e9f0a1b2c3
Revises: c7f2a1b9d4e5
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "c7f2a1b9d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SYSTEM_SECTIONS = [
    ("trending", "Trending Now"),
    ("new_arrival", "New Arrivals"),
    ("featured", "Exotic Finds"),
    ("plant_care", "Everything Your Plant Needs"),
    ("decor_pots", "Chic Ceramic for Decor"),
]


def _display_name(key: str) -> str:
    return " ".join(key.replace("_", " ").replace("-", " ").split()).title()


def upgrade() -> None:
    op.create_table(
        "display_sections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_display_sections_id"), "display_sections", ["id"], unique=False)
    op.create_index(
        op.f("ix_display_sections_key"),
        "display_sections",
        ["key"],
        unique=True,
    )
    op.create_index(
        op.f("ix_display_sections_sort_order"),
        "display_sections",
        ["sort_order"],
        unique=False,
    )

    section_table = sa.table(
        "display_sections",
        sa.column("name", sa.String),
        sa.column("key", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("is_system", sa.Boolean),
    )
    bind = op.get_bind()
    existing_values = bind.execute(
        sa.text(
            "SELECT DISTINCT display_section FROM products "
            "WHERE display_section IS NOT NULL AND TRIM(display_section) <> ''"
        )
    ).fetchall()

    sections_by_key: dict[str, dict[str, object]] = {}
    for order, (key, name) in enumerate(SYSTEM_SECTIONS):
        sections_by_key[key] = {
            "name": name,
            "key": key,
            "sort_order": order,
            "is_active": True,
            "is_system": True,
        }

    next_order = len(SYSTEM_SECTIONS)
    for (raw_key,) in existing_values:
        key = str(raw_key).strip()[:50]
        if not key or key in sections_by_key:
            continue
        sections_by_key[key] = {
            "name": _display_name(key),
            "key": key,
            "sort_order": next_order,
            "is_active": True,
            "is_system": False,
        }
        next_order += 1

    if sections_by_key:
        bind.execute(sa.insert(section_table), list(sections_by_key.values()))


def downgrade() -> None:
    op.drop_index(op.f("ix_display_sections_sort_order"), table_name="display_sections")
    op.drop_index(op.f("ix_display_sections_key"), table_name="display_sections")
    op.drop_index(op.f("ix_display_sections_id"), table_name="display_sections")
    op.drop_table("display_sections")
