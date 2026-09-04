"""Add menu_items table

Revision ID: d1e2f3a4b5c6
Revises: 21a065266e7f
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = '21a065266e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Seed data: mirrors the current hardcoded STATIC_LINKS + GIFTING_SUBMENU
SEED_ITEMS = [
    # Top-level items
    {"label": "Gifting",         "href": "/products?tags=gifting",          "image_url": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=280&q=80", "accent_color": "#f9c8d4", "highlight": False, "sort_order": 0},
    {"label": "Corporate Gifts", "href": "/corporate-gifting",              "image_url": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=280&q=80", "accent_color": "#cdebd7", "highlight": False, "sort_order": 1},
    {"label": "Garden Services", "href": "/products?tags=garden-services",  "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=280&q=80", "accent_color": "#d6e6f5", "highlight": False, "sort_order": 2},
    {"label": "Blog",            "href": "/blog",                           "image_url": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=280&q=80", "accent_color": "#f9c8d4", "highlight": False, "sort_order": 3},
    {"label": "Offers",          "href": "/products?tags=offers",           "image_url": "https://images.unsplash.com/photo-1560693225-b8507d6f3aa9?w=280&q=80", "accent_color": "#f9e4a0", "highlight": True,  "sort_order": 4},
    # Submenu items (parent_label resolved at seed time)
    {"label": "All Gifts",           "href": "/products?tags=gifting",         "parent_label": "Gifting", "sort_order": 0},
    {"label": "Plant Gifting",       "href": "/products?tags=gifting",         "parent_label": "Gifting", "sort_order": 1},
    {"label": "Corporate Gifting",   "href": "/corporate-gifting",             "parent_label": "Gifting", "sort_order": 2},
    {"label": "Vastu Gifting",       "href": "/products?tags=vastu-friendly",  "parent_label": "Gifting", "sort_order": 3},
]


def upgrade() -> None:
    """Create menu_items table and seed default data."""
    op.create_table(
        'menu_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=False),
        sa.Column('href', sa.String(length=512), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('image_url', sa.String(length=512), nullable=True),
        sa.Column('accent_color', sa.String(length=20), nullable=True),
        sa.Column('highlight', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['menu_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('label', 'parent_id', name='uq_menu_items_label_parent'),
    )
    with op.batch_alter_table('menu_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_menu_items_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_menu_items_parent_id'), ['parent_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_menu_items_sort_order'), ['sort_order'], unique=False)
        batch_op.create_index(batch_op.f('ix_menu_items_is_active'), ['is_active'], unique=False)

    # Seed default menu items (idempotent: skip if table already has rows)
    conn = op.get_bind()
    count = conn.execute(sa.text("SELECT COUNT(*) FROM menu_items")).scalar()
    if count == 0:
        # Insert top-level items first (parents before children)
        parent_id_map = {}
        for item in SEED_ITEMS:
            if "parent_label" not in item:
                conn.execute(
                    sa.text(
                        "INSERT INTO menu_items (label, href, parent_id, image_url, accent_color, highlight, sort_order, is_active, created_at) "
                        "VALUES (:label, :href, NULL, :image_url, :accent_color, :highlight, :sort_order, true, CURRENT_TIMESTAMP)"
                    ),
                    {
                        "label": item["label"],
                        "href": item["href"],
                        "image_url": item.get("image_url"),
                        "accent_color": item.get("accent_color"),
                        "highlight": bool(item.get("highlight")),
                        "sort_order": item.get("sort_order", 0),
                    },
                )
                # Get the inserted id
                row = conn.execute(
                    sa.text("SELECT id FROM menu_items WHERE label = :label AND parent_id IS NULL"),
                    {"label": item["label"]},
                ).fetchone()
                parent_id_map[item["label"]] = row[0]

        # Insert submenu items
        for item in SEED_ITEMS:
            if "parent_label" in item:
                parent_id = parent_id_map.get(item["parent_label"])
                conn.execute(
                    sa.text(
                        "INSERT INTO menu_items (label, href, parent_id, image_url, accent_color, highlight, sort_order, is_active, created_at) "
                        "VALUES (:label, :href, :parent_id, NULL, NULL, false, :sort_order, true, CURRENT_TIMESTAMP)"
                    ),
                    {
                        "label": item["label"],
                        "href": item["href"],
                        "parent_id": parent_id,
                        "sort_order": item.get("sort_order", 0),
                    },
                )


def downgrade() -> None:
    """Drop menu_items table."""
    with op.batch_alter_table('menu_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_menu_items_is_active'))
        batch_op.drop_index(batch_op.f('ix_menu_items_sort_order'))
        batch_op.drop_index(batch_op.f('ix_menu_items_parent_id'))
        batch_op.drop_index(batch_op.f('ix_menu_items_id'))

    op.drop_table('menu_items')
