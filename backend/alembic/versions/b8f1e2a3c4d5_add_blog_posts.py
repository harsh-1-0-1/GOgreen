"""add_blog_posts

Revision ID: b8f1e2a3c4d5
Revises: 9fdefd074201
Create Date: 2026-04-18 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b8f1e2a3c4d5"
down_revision: Union[str, Sequence[str], None] = "9fdefd074201"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("excerpt", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.String(length=512), nullable=True),
        sa.Column(
            "category",
            sa.Enum("GROW", "CARE", "DIY", "TIPS", name="blogcategory"),
            nullable=False,
        ),
        sa.Column("author_name", sa.String(length=255), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("blog_posts", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_blog_posts_id"), ["id"], unique=False)
        batch_op.create_index(batch_op.f("ix_blog_posts_slug"), ["slug"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("blog_posts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_blog_posts_slug"))
        batch_op.drop_index(batch_op.f("ix_blog_posts_id"))
    op.drop_table("blog_posts")
