"""dedupe_carts_add_unique_constraints

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-17 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _dedupe_carts(conn, group_column: str) -> None:
    dup_groups = conn.execute(sa.text(f"""
        SELECT {group_column}, MIN(id) AS keep_id
        FROM carts
        WHERE {group_column} IS NOT NULL
        GROUP BY {group_column}
        HAVING COUNT(*) > 1
    """)).fetchall()

    for group_value, keep_id in dup_groups:
        dup_ids = conn.execute(
            sa.text(f"""
                SELECT id FROM carts
                WHERE {group_column} = :group_value AND id != :keep_id
            """),
            {"group_value": group_value, "keep_id": keep_id},
        ).fetchall()

        for (dup_id,) in dup_ids:
            conn.execute(
                sa.text("""
                    UPDATE cart_items
                    SET cart_id = :keep_id
                    WHERE cart_id = :dup_id
                """),
                {"keep_id": keep_id, "dup_id": dup_id},
            )
            conn.execute(
                sa.text("DELETE FROM carts WHERE id = :dup_id"),
                {"dup_id": dup_id},
            )


def upgrade() -> None:
    conn = op.get_bind()
    _dedupe_carts(conn, "user_id")
    _dedupe_carts(conn, "session_id")

    op.create_index(
        'ix_carts_user_id_unique',
        'carts',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('user_id IS NOT NULL'),
    )
    op.create_index(
        'ix_carts_session_id_unique',
        'carts',
        ['session_id'],
        unique=True,
        postgresql_where=sa.text('session_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_carts_session_id_unique', table_name='carts')
    op.drop_index('ix_carts_user_id_unique', table_name='carts')
