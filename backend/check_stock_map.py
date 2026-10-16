"""CI/startup check: every variant_groups product must carry a dense stock_map.

The per-combination stock code (VARIANT_COMBO_STOCK_PLAN.md) requires `stock_map` on every
`variant_groups` product; a missing map fails loudly at runtime (STOCK_MAP_MISSING). This
check scans the DB so the requirement cannot silently regress after the migration has run.

Exit code 0 when all variant_groups products have a stock_map, 1 otherwise.

Usage:
    uv run python check_stock_map.py
"""

import asyncio
import sys

from sqlalchemy import select

from app.db.models import Product
from app.db.session import async_session_factory


async def check() -> int:
    async with async_session_factory() as db:
        result = await db.execute(select(Product))
        products = result.scalars().all()

    missing = []
    for product in products:
        variants = product.variants or {}
        if "variant_groups" not in variants:
            continue
        stock_map = variants.get("stock_map")
        if not isinstance(stock_map, dict) or not stock_map:
            missing.append(product)

    if missing:
        print("STOCK_MAP_MISSING on the following products (run `uv run python migrate_stock_map.py`):")
        for product in missing:
            print(f"  - id={product.id} name={product.name!r} slug={product.slug!r}")
        return 1

    print(f"OK: all {len([p for p in products if 'variant_groups' in (p.variants or {})])} "
          "variant_groups product(s) have a stock_map.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(check()))
