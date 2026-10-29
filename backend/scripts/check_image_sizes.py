"""Show the real pixel size of a product's gallery images.

The product page shows each image in a square box. With `object-cover`, any
image that is not square gets its longer side cut off; this script tells you
whether that is happening and by how much.

Usage (from the backend folder, or inside the backend container):
    python scripts/check_image_sizes.py <product-slug>
    python scripts/check_image_sizes.py --all        # every product, non-square only
"""

import asyncio
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.db.models import Product  # noqa: E402
from app.db.session import async_session_factory  # noqa: E402
from app.utils.image_upload import (  # noqa: E402
    collect_variant_image_keys,
    image_variant_set,
)

# The URLs the storefront gallery actually loads.
CHECKED_VARIANTS = ("original", "card", "detail")


def fetch_size(url: str) -> tuple[int, int] | str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "plantoga-size-check"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        with Image.open(BytesIO(data)) as img:
            return img.size
    except Exception as exc:  # report and keep going
        return f"ERROR {exc}"


def describe(width: int, height: int) -> str:
    if width == height:
        return "square: nothing cropped"
    if width > height:
        lost = (1 - height / width) * 100
        return f"WIDE {width / height:.2f}:1, object-cover hides {lost:.0f}% of width ({lost / 2:.0f}% each side)"
    lost = (1 - width / height) * 100
    return f"TALL 1:{height / width:.2f}, object-cover hides {lost:.0f}% of height ({lost / 2:.0f}% top and bottom)"


async def check(product: Product, only_problems: bool) -> None:
    keys = list(product.images or [])
    keys += [k for k in collect_variant_image_keys(product.variants) if k not in keys]
    lines = []
    for key in keys:
        urls = image_variant_set(key)
        for name in CHECKED_VARIANTS:
            url = urls.get(name)
            if not url:
                continue
            size = await asyncio.to_thread(fetch_size, url)
            if isinstance(size, str):
                lines.append(f"  [{name:8}] {size}\n             {url}")
                continue
            w, h = size
            if only_problems and w == h:
                continue
            lines.append(f"  [{name:8}] {w}x{h}  {describe(w, h)}\n             {url}")
    if lines or not only_problems:
        print(f"\n== {product.name} (slug={product.slug}, id={product.id}) ==")
        print("\n".join(lines) if lines else "  no images")


async def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    arg = sys.argv[1]
    async with async_session_factory() as db:
        if arg == "--all":
            products = (await db.execute(select(Product).order_by(Product.id))).scalars().all()
        else:
            products = (await db.execute(select(Product).where(Product.slug == arg))).scalars().all()
            if not products:
                print(f"No product with slug {arg!r}")
                sys.exit(1)
    for product in products:
        await check(product, only_problems=(arg == "--all"))


if __name__ == "__main__":
    asyncio.run(main())
