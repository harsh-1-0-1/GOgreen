"""add care_items JSON, migrate sunlight/watering image data, drop old image columns

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-07-26 12:00:00.000000

Forward migration:
  1. Add care_items JSON NULL column to products
  2. For any product that already has sunlight_image or watering_image set,
     build a care_items array from them so no data is silently lost
  3. Drop sunlight_image and watering_image columns
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the new flexible column
    op.add_column('products', sa.Column('care_items', sa.JSON(), nullable=True))

    # 2. Forward-migrate existing sunlight_image / watering_image data into care_items
    #    so no admin-uploaded icons are silently discarded on deploy.
    #    We build a list of {icon, title, description} dicts and store it as JSON.
    conn = op.get_bind()

    # Fetch every product that has at least one of the old image columns set
    rows = conn.execute(
        text(
            "SELECT id, sunlight, watering, sunlight_image, watering_image "
            "FROM products "
            "WHERE sunlight_image IS NOT NULL OR watering_image IS NOT NULL"
        )
    ).fetchall()

    for row in rows:
        items = []
        if row.sunlight_image:
            items.append({
                "icon": row.sunlight_image,
                "title": "Light",
                "description": row.sunlight or "",
            })
        if row.watering_image:
            items.append({
                "icon": row.watering_image,
                "title": "Water",
                "description": row.watering or "",
            })
        if items:
            import json
            conn.execute(
                text("UPDATE products SET care_items = :val WHERE id = :id"),
                {"val": json.dumps(items), "id": row.id},
            )

    # 3. Drop the old fixed-image columns
    op.drop_column('products', 'watering_image')
    op.drop_column('products', 'sunlight_image')


def downgrade() -> None:
    # Restore the old columns (data in care_items is NOT migrated back — acceptable)
    op.add_column('products', sa.Column('sunlight_image', sa.String(500), nullable=True))
    op.add_column('products', sa.Column('watering_image', sa.String(500), nullable=True))
    op.drop_column('products', 'care_items')
