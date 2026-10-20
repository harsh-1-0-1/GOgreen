"""Replace the old CloudFront domain with the new one in every text/JSON column.

Some rows store full image URLs instead of S3 keys. The backend only turns a
full URL back into a key when it starts with the *current* CDN_BASE_URL, so
after an account move those rows would keep pointing at the old distribution.
Swapping the domain makes them point at the new one (which serves the same
keys), and the backend then resolves them like any other key.

Usage (inside the backend container, after the images are copied):

    python scripts/replace_cdn_domain.py OLD_DOMAIN NEW_DOMAIN            # dry run
    python scripts/replace_cdn_domain.py OLD_DOMAIN NEW_DOMAIN --apply

Back up the database before using --apply.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine  # noqa: E402

COLUMN_TYPES = ("text", "character varying", "json", "jsonb")


async def run(old: str, new: str, apply: bool) -> None:
    async with engine.begin() as conn:
        cols = (
            await conn.execute(
                text(
                    "SELECT table_name, column_name, data_type FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND data_type = ANY(:types) "
                    "AND table_name <> 'alembic_version' ORDER BY table_name, column_name"
                ),
                {"types": list(COLUMN_TYPES)},
            )
        ).all()

        total = 0
        for table, column, data_type in cols:
            where = f'"{column}"::text LIKE :pattern'
            count = (
                await conn.execute(
                    text(f'SELECT count(*) FROM "{table}" WHERE {where}'),
                    {"pattern": f"%{old}%"},
                )
            ).scalar_one()
            if not count:
                continue
            total += count
            print(f"{table}.{column} ({data_type}): {count} rows")
            if apply:
                await conn.execute(
                    text(
                        f'UPDATE "{table}" SET "{column}" = '
                        f'replace("{column}"::text, :old, :new)::{data_type} WHERE {where}'
                    ),
                    {"old": old, "new": new, "pattern": f"%{old}%"},
                )

        if apply:
            print(f"\nUpdated {total} rows: {old} -> {new}")
        else:
            print(f"\n{total} rows contain {old}. Dry run, nothing changed. Add --apply to update.")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("old", help="e.g. d1ebww11cb084g.cloudfront.net")
    parser.add_argument("new", help="e.g. d157ne8ap1dxre.cloudfront.net")
    parser.add_argument("--apply", action="store_true", help="write the changes")
    args = parser.parse_args()
    asyncio.run(run(args.old, args.new, args.apply))


if __name__ == "__main__":
    main()
