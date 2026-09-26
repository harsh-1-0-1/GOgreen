"""add_web_image_to_banners

Adds a dedicated desktop/web image column (plus its S3 public id) so a banner can
carry a separate wide crop for desktop without changing `image_url`, which stays
the mobile/legacy image. Mirrors the pattern already used by
`categories.mobile_image_url`.

Revision ID: e4f5a6b7c8d9
Revises: d8e9f0a1b2c3
Create Date: 2026-09-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add web image columns to banners."""
    with op.batch_alter_table("banners", schema=None) as batch_op:
        batch_op.add_column(sa.Column("image_url_web", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("image_public_id_web", sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Drop web image columns from banners."""
    with op.batch_alter_table("banners", schema=None) as batch_op:
        batch_op.drop_column("image_public_id_web")
        batch_op.drop_column("image_url_web")
