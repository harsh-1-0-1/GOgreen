"""One-time migration: backfill a dense per-combination stock_map on variant_groups products.

Storage change (see VARIANT_COMBO_STOCK_PLAN.md): availability moves from per-option
`options[].stock` to a new sibling JSON field `variants.stock_map: Record<comboKey, int>`.

For each product with `variant_groups` this script:
  1. Walks the cartesian product of options (same iteration as the frontend buildComboRows,
     ignoring the cap).
  2. For each combo row sets stock = min of the option stocks it references — reproducing
     today's per-option availability exactly as the starting point.
  3. Writes `variants.stock_map` for EVERY row (including 0 values) and `flag_modified`.
  4. Recomputes `product.stock_qty = sum(stock_map.values())`.

Idempotent by construction: every run fully overwrites stock_map from the current
`options[].stock` (the single, script-untouched migration source). Re-running after a
DB reset/reseed is safe and deterministic.

MUST be run before the per-combo code ships — new code fails loudly (STOCK_MAP_MISSING)
when stock_map is absent.

Usage:
    uv run python migrate_stock_map.py
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import Product
from app.db.session import async_session_factory
from app.utils.variant_pricing import build_dense_stock_map


async def migrate() -> int:
    migrated = 0
    async with async_session_factory() as db:
        result = await db.execute(select(Product))
        products = result.scalars().all()

        for product in products:
            variants = product.variants or {}
            if "variant_groups" not in variants:
                continue

            groups = variants.get("variant_groups", [])
            stock_map = build_dense_stock_map(groups)

            variants["stock_map"] = stock_map
            product.variants = variants
            product.stock_qty = sum(int(v or 0) for v in stock_map.values())
            flag_modified(product, "variants")
            migrated += 1
            print(
                f"  {product.id:>4}  {product.name:<40} {len(stock_map):>3} combos → stock_qty={product.stock_qty}"
            )

        await db.commit()
        print(f"\nMigrated {migrated} product(s). stock_qty now reflects sum(stock_map.values()).")
        return migrated


if __name__ == "__main__":
    asyncio.run(migrate())
