"""Seed script: 30 categories + 26 products (1 per subcategory) for Plantoga.

Usage:
    uv run python seed.py                 # full reset (all tables)
    uv run python seed.py --only-catalog  # categories + products only

WARNING: the full run wipes ALL rows (categories, products, users,
carts, orders, banners, ...) before seeding. NEVER run it against a
live/production database. Run it only on a fresh or throwaway test
database.

--only-catalog only touches categories and products and is safe to run
against an existing dev DB (banners, blog posts, users, carts, orders
and addresses are left untouched).
"""

import asyncio
import os
import random
import re
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.db.models import (
    Address,
    Banner,
    BlogCategory,
    BlogPost,
    Cart,
    CartItem,
    Category,
    DamageClaim,
    Order,
    OrderItem,
    Product,
    ProductReview,
    Story,
    User,
)


def _resolve_database_url() -> str | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        from app.core.config import settings
        url = settings.DATABASE_URL
    if not url or url.startswith("sqlite"):
        return None
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_db_url = _resolve_database_url()
if _db_url:
    engine = create_async_engine(_db_url, future=True)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
else:
    engine = None
    async_session_factory = None

UNSPLASH = "https://images.unsplash.com/photo-{id}?w=600&q=80"
UNSPLASH_BANNER = "https://images.unsplash.com/photo-{id}?w=1400&h=300&fit=crop&crop=center&q=85"

PLANT_IMAGES = [
    UNSPLASH.format(id="1459411552884-841db9b3cc2a"),
    UNSPLASH.format(id="1463936575829-25148e1db1b8"),
    UNSPLASH.format(id="1509423350716-97f9360b4e09"),
    UNSPLASH.format(id="1520412099551-62b6bafeb5bb"),
    UNSPLASH.format(id="1485955900006-d5666c72437d"),
    UNSPLASH.format(id="1501004318776-cd2ba00a9cee"),
    UNSPLASH.format(id="1416879595882-3373a0480b5b"),
    UNSPLASH.format(id="1466692476868-aef1dfb1e735"),
]

CATEGORIES = [
    # Top-level (menu order 1-4)
    {"name": "Plants", "slug": "plants", "parent_id": None, "sort_order": 1},
    {"name": "Seeds", "slug": "seeds", "parent_id": None, "sort_order": 2},
    {"name": "Pots & Planters", "slug": "pots-planters", "parent_id": None, "sort_order": 3},
    {"name": "Plant Care", "slug": "plant-care", "parent_id": None, "sort_order": 4},
    # Plants subcategories
    {"name": "Indoor Plants", "slug": "indoor-plants", "parent_slug": "plants", "sort_order": 1},
    {"name": "Outdoor Plants", "slug": "outdoor-plants", "parent_slug": "plants", "sort_order": 2},
    {"name": "Flowering Plants", "slug": "flowering-plants", "parent_slug": "plants", "sort_order": 3},
    {"name": "Cacti & Succulents", "slug": "cacti-succulents", "parent_slug": "plants", "sort_order": 4},
    {"name": "XL Plants", "slug": "xl-plants", "parent_slug": "plants", "sort_order": 5},
    {"name": "Low Maintenance Plants", "slug": "low-maintenance-plants", "parent_slug": "plants", "sort_order": 6},
    {"name": "Air Purifying Plants", "slug": "air-purifying-plants", "parent_slug": "plants", "sort_order": 7},
    {"name": "Hanging Plants", "slug": "hanging-plants", "parent_slug": "plants", "sort_order": 8},
    {"name": "Pet-Friendly Plants", "slug": "pet-friendly-plants", "parent_slug": "plants", "sort_order": 9},
    {"name": "Fruit Plants", "slug": "fruit-plants", "parent_slug": "plants", "sort_order": 10},
    # Seeds subcategories
    {"name": "Vegetable Seeds", "slug": "vegetable-seeds", "parent_slug": "seeds", "sort_order": 1},
    {"name": "Flower Seeds", "slug": "flower-seeds", "parent_slug": "seeds", "sort_order": 2},
    {"name": "Microgreen Seeds", "slug": "microgreen-seeds", "parent_slug": "seeds", "sort_order": 3},
    {"name": "Herb Seeds", "slug": "herb-seeds", "parent_slug": "seeds", "sort_order": 4},
    {"name": "Flower Bulbs", "slug": "flower-bulbs", "parent_slug": "seeds", "sort_order": 5},
    {"name": "Seeds Kits", "slug": "seeds-kits", "parent_slug": "seeds", "sort_order": 6},
    # Pots subcategories
    {"name": "Plastic Pots", "slug": "plastic-pots", "parent_slug": "pots-planters", "sort_order": 1},
    {"name": "Ceramic Pots", "slug": "ceramic-pots", "parent_slug": "pots-planters", "sort_order": 2},
    {"name": "Metal Planters", "slug": "metal-planters", "parent_slug": "pots-planters", "sort_order": 3},
    {"name": "Wooden Planters", "slug": "wooden-planters", "parent_slug": "pots-planters", "sort_order": 4},
    {"name": "Hanging Planters", "slug": "hanging-planters", "parent_slug": "pots-planters", "sort_order": 5},
    {"name": "Plant Stands", "slug": "plant-stands", "parent_slug": "pots-planters", "sort_order": 6},
    # Plant Care subcategories
    {"name": "Potting Mix & Fertilizers", "slug": "potting-mix-fertilizers", "parent_slug": "plant-care", "sort_order": 1},
    {"name": "Garden Tools", "slug": "garden-tools", "parent_slug": "plant-care", "sort_order": 2},
    {"name": "Watering Tools", "slug": "watering-tools", "parent_slug": "plant-care", "sort_order": 3},
    {"name": "Pest Control", "slug": "pest-control", "parent_slug": "plant-care", "sort_order": 4},
]

# Representative thumbnail per category, used by the DB-driven menu.
CATEGORY_IMAGES = {
    "plants": "1459411552884-841db9b3cc2a",
    "seeds": "1592321675774-3de57f3ee0dc",
    "pots-planters": "1616486338812-3dadae4b4ace",
    "plant-care": "1584132967334-10e028bd69f7",
    "indoor-plants": "1545241047-6083a3684587",
    "outdoor-plants": "1466692476868-aef1dfb1e735",
    "flowering-plants": "1416879595882-3373a0480b5b",
    "cacti-succulents": "1509587584298-0f3b3a3a1797",
    "xl-plants": "1485955900006-d5666c72437d",
    "low-maintenance-plants": "1509423350716-97f9360b4e09",
    "air-purifying-plants": "1501004318776-cd2ba00a9cee",
    "hanging-plants": "1614594975525-e45190c55d0b",
    "pet-friendly-plants": "1496096265110-f83ad7f96608",
    "fruit-plants": "1544971587-b8420c2e1512",
    "vegetable-seeds": "1599599810769-bcde5a160d32",
    "flower-seeds": "1592321675774-3de57f3ee0dc",
    "microgreen-seeds": "1545241047-6083a3684587",
    "herb-seeds": "1416879595882-3373a0480b5b",
    "flower-bulbs": "1506880018603-83d5b814b5a6",
    "seeds-kits": "1593014606132-7360706692aa",
    "plastic-pots": "1592150621744-aca64f48394a",
    "ceramic-pots": "1616486338812-3dadae4b4ace",
    "metal-planters": "1497366216548-37526070297c",
    "wooden-planters": "1520412099551-62b6bafeb5bb",
    "hanging-planters": "1614594975525-e45190c55d0b",
    "plant-stands": "1592150621744-aca64f48394a",
    "potting-mix-fertilizers": "1501004318641-b39e6451bec6",
    "garden-tools": "1502082553048-f009c37129b9",
    "watering-tools": "1481349518771-20055b2a7b24",
    "pest-control": "1599599810769-bcde5a160d32",
}
def _make_variants(stock_per_option: int = 10) -> dict:
    """Standard plant variant: Select Pot Colour + Select Pot Material."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    colors = [
        {"id": oid(), "name": "Terracotta",  "price": 0,   "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=600&q=80"]},
        {"id": oid(), "name": "Sage Green",  "price": 0,   "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1501004318776-cd2ba00a9cee?w=600&q=80"]},
        {"id": oid(), "name": "White",       "price": 0,   "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1485955900006-d5666c72437d?w=600&q=80"]},
        {"id": oid(), "name": "Charcoal",    "price": 0,   "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=600&q=80"]},
        {"id": oid(), "name": "Dusty Pink",  "price": 0,   "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80"]},
    ]
    materials = [
        {"id": oid(), "name": "Plastic",       "price": 0,   "stock": stock_per_option},
        {"id": oid(), "name": "Ceramic",       "price": 150, "stock": stock_per_option},
        {"id": oid(), "name": "Terracotta Pot","price": 100, "stock": stock_per_option},
        {"id": oid(), "name": "Metal",         "price": 200, "stock": stock_per_option},
        {"id": oid(), "name": "Hanging",       "price": 120, "stock": stock_per_option},
    ]
    return {
        "variant_groups": [
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Pot Colour",   "options": colors},
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Pot Material", "options": materials},
        ],
        "default_image": "https://images.unsplash.com/photo-1501004318776-cd2ba00a9cee?w=600&q=80",
    }


def _make_variants_with_sizes(stock_per_option: int = 10) -> dict:
    """Plant variant: Select Size + Select Pot Colour + Select Pot Material."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    sizes = [
        {"id": oid(), "name": "Small (6–10\")",  "price": 0,   "stock": stock_per_option},
        {"id": oid(), "name": "Medium (12–18\")", "price": 150, "stock": stock_per_option},
        {"id": oid(), "name": "Large (24+\")",    "price": 350, "stock": stock_per_option},
    ]
    colors = [
        {"id": oid(), "name": "Terracotta",  "price": 0,  "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=600&q=80"]},
        {"id": oid(), "name": "Sage Green",  "price": 0,  "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1501004318776-cd2ba00a9cee?w=600&q=80"]},
        {"id": oid(), "name": "White",       "price": 0,  "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1485955900006-d5666c72437d?w=600&q=80"]},
        {"id": oid(), "name": "Charcoal",    "price": 0,  "stock": stock_per_option,
         "images": ["https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=600&q=80"]},
    ]
    materials = [
        {"id": oid(), "name": "Plastic",       "price": 0,   "stock": stock_per_option},
        {"id": oid(), "name": "Ceramic",       "price": 150, "stock": stock_per_option},
        {"id": oid(), "name": "Terracotta Pot","price": 100, "stock": stock_per_option},
        {"id": oid(), "name": "Metal",         "price": 200, "stock": stock_per_option},
    ]
    return {
        "variant_groups": [
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Plant Size",   "options": sizes},
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Pot Colour",   "options": colors},
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Pot Material", "options": materials},
        ],
        "default_image": "https://images.unsplash.com/photo-1501004318776-cd2ba00a9cee?w=600&q=80",
    }


def _make_size_only_variants(stock_per_option: int = 15) -> dict:
    """Plant size-only variant: Select Size."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    sizes = [
        {"id": oid(), "name": "Small (6–10\")",  "price": 0,   "stock": stock_per_option},
        {"id": oid(), "name": "Medium (12–18\")", "price": 200, "stock": stock_per_option},
        {"id": oid(), "name": "Large (24+\")",    "price": 500, "stock": stock_per_option},
    ]
    return {
        "variant_groups": [
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Plant Size", "options": sizes},
        ],
        "default_image": "",
    }


def _make_seed_variants() -> dict:
    """Seed packet variant: Select Packet Size."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    return {
        "variant_groups": [
            {
                "id": f"vg_{uuid.uuid4().hex[:8]}",
                "label": "Select Packet Size",
                "options": [
                    {"id": oid(), "name": "Small Packet (25 seeds)",  "price": 0,   "stock": 50},
                    {"id": oid(), "name": "Medium Packet (50 seeds)", "price": 40,  "stock": 30},
                    {"id": oid(), "name": "Large Packet (100 seeds)", "price": 90,  "stock": 20},
                ],
            }
        ],
    }


def _make_pot_variants(base_price: int) -> dict:
    """Standalone pot variant: Select Pot Size + Select Colour."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    sizes = [
        {"id": oid(), "name": "Small (4–6\")",    "price": base_price,           "stock": 20},
        {"id": oid(), "name": "Medium (8–10\")",  "price": round(base_price * 1.4), "stock": 15},
        {"id": oid(), "name": "Large (12–14\")",  "price": round(base_price * 1.9), "stock": 10},
    ]
    colours = [
        {"id": oid(), "name": "White",      "price": 0,  "stock": 15},
        {"id": oid(), "name": "Terracotta", "price": 0,  "stock": 15},
        {"id": oid(), "name": "Black",      "price": 0,  "stock": 12},
        {"id": oid(), "name": "Green",      "price": 0,  "stock": 10},
    ]
    return {
        "variant_groups": [
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Pot Size", "options": sizes},
            {"id": f"vg_{uuid.uuid4().hex[:8]}", "label": "Select Colour",   "options": colours},
        ],
    }


def _make_care_variants(unit_label: str, options: list) -> dict:
    """Generic care product variant (fertiliser weight, tool size, capacity, etc.)."""
    import uuid
    def oid(): return f"opt_{uuid.uuid4().hex[:8]}"

    return {
        "variant_groups": [
            {
                "id": f"vg_{uuid.uuid4().hex[:8]}",
                "label": unit_label,
                "options": [
                    {"id": oid(), "name": o["name"], "price": o["price"], "stock": o.get("stock", 20)}
                    for o in options
                ],
            }
        ],
    }


def _attach_stock_map(variants: dict) -> dict:
    """Add a dense per-combination stock_map to a variant_groups structure.

    Reproduces the one-time migration's starting point (min of option stocks per combo
    row) so seeded products behave like migrated production data.
    """
    from app.utils.variant_pricing import build_dense_stock_map

    groups = variants.get("variant_groups") or []
    if not groups:
        return variants
    variants["stock_map"] = build_dense_stock_map(groups)
    return variants


PRODUCTS = [
        {"name": "Money Plant Golden", "cat": "indoor-plants", "price": 249,
         "desc": "Air-purifying trailing vine perfect for shelves and hanging baskets.",
         "sunlight": "Low to Bright Indirect", "watering": "Once a week",
         "tags": ["air-purifying", "low-maintenance", "indoor", "beginner-friendly", "workspace", "living-room"],
         "care_tips": ["Water when topsoil feels dry", "Prune to encourage bushier growth"],
         "badge": "Bestseller",
         "variants": _make_variants_with_sizes()},
    {"name": "Bougainvillea", "cat": "outdoor-plants", "price": 349, "desc": "Vibrant paper-like flowers in magenta that bloom year round.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["flowering", "drought-tolerant", "climber", "balcony"], "care_tips": ["Needs 6+ hours of sun", "Prune after each flowering cycle"], "badge": "Bestseller"},
    {"name": "Anthurium Red", "cat": "flowering-plants", "price": 599, "desc": "Glossy heart-shaped red spathes that bloom for weeks.", "sunlight": "Bright Indirect", "watering": "Twice a week", "tags": ["flowering", "indoor", "gift", "gifting"], "care_tips": ["High humidity preferred", "Avoid direct sun"], "badge": "Gift Pick"},
    {"name": "Echeveria Elegans", "cat": "cacti-succulents", "price": 199, "desc": "Blue-green rosette succulent, perfect for terrariums.", "sunlight": "Bright Direct", "watering": "Every 2 weeks", "tags": ["succulent", "rosette", "terrarium"], "care_tips": ["Use well-draining soil", "Avoid water on leaves"]},
    {"name": "Tomato Seeds (Cherry)", "cat": "vegetable-seeds", "price": 99, "desc": "Pack of 50 seeds – sweet cherry tomatoes, harvest in 60 days.", "sunlight": "Full Sun", "watering": "Daily", "tags": ["seeds", "edible", "kitchen-garden"], "care_tips": ["Start indoors 6 weeks before last frost", "Stake when 30 cm tall"]},
    {"name": "Sunflower Seeds", "cat": "flower-seeds", "price": 99, "desc": "Giant sunflower pack – grows up to 6 feet tall.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["seeds", "flowering", "tall"], "care_tips": ["Direct sow after last frost", "Support stems in wind"]},
    {"name": "Fiddle Leaf Fig XL", "cat": "xl-plants", "price": 2499, "desc": "Statement floor plant with large violin-shaped leaves, 4 ft tall.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["xl", "statement", "indoor", "living-room"], "care_tips": ["Wipe leaves monthly", "Rotate quarterly for even growth"], "badge": "XL"},
    {"name": "Cast Iron Plant", "cat": "low-maintenance-plants", "price": 599, "desc": "Nearly indestructible plant that thrives in dark corners.", "sunlight": "Low to Bright Indirect", "watering": "Every 2 weeks", "tags": ["low-maintenance", "shade-tolerant", "beginner-friendly"], "care_tips": ["Tolerates neglect well", "Avoid direct sun"]},
    {"name": "Boston Fern", "cat": "air-purifying-plants", "price": 349, "desc": "Lush hanging fern that removes formaldehyde and adds humidity.", "sunlight": "Bright Indirect", "watering": "Keep moist", "tags": ["air-purifying", "hanging", "tropical"], "care_tips": ["Mist daily in dry weather", "Keep away from heating vents"]},
    {"name": "String of Hearts", "cat": "hanging-plants", "price": 399, "desc": "Delicate heart-shaped leaves on trailing silvery vines.", "sunlight": "Bright Indirect", "watering": "Every 10 days", "tags": ["trailing", "hanging", "romantic"], "care_tips": ["Let soil dry between waterings", "Propagate easily from cuttings"]},
    {"name": "Calathea Orbifolia", "cat": "pet-friendly-plants", "price": 599, "desc": "Large round striped leaves, completely safe for cats and dogs.", "sunlight": "Medium Indirect", "watering": "Twice a week", "tags": ["pet-safe", "tropical", "indoor"], "care_tips": ["Use filtered water", "Loves humidity"]},
    {"name": "Lemon Plant", "cat": "fruit-plants", "price": 599, "desc": "Dwarf lemon tree that fruits on balconies and terraces.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["fruit", "edible", "outdoor"], "care_tips": ["Needs 6+ hours of sun", "Feed with citrus fertiliser monthly"]},
    {"name": "Microgreen Seeds – Mustard", "cat": "microgreen-seeds", "price": 99, "desc": "Spicy microgreens ready to harvest in just 7 days.", "sunlight": "Indirect Light", "watering": "Mist twice daily", "tags": ["seeds", "microgreen", "edible"], "care_tips": ["Use shallow tray with soilless medium", "Harvest at 2 inch height"]},
    {"name": "Basil Seeds (Sweet)", "cat": "herb-seeds", "price": 79, "desc": "Aromatic Italian basil for pesto, salads and cooking.", "sunlight": "Full Sun", "watering": "Daily", "tags": ["seeds", "herb", "edible", "kitchen-garden"], "care_tips": ["Pinch flower buds to extend harvest", "Sow indoors 6 weeks before summer"]},
    {"name": "Tuberose Bulbs (Pack of 5)", "cat": "flower-bulbs", "price": 199, "desc": "Fragrant white flowers, a summer garden favourite.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["seeds", "bulb", "fragrant", "flowering"], "care_tips": ["Plant 4 inches deep", "Lift bulbs in winter in cold regions"]},
    {"name": "Kitchen Garden Starter Kit", "cat": "seeds-kits", "price": 499, "desc": "Everything to grow tomatoes, chillies, and coriander at home.", "tags": ["seeds", "kit", "kitchen-garden", "beginner-friendly"], "care_tips": ["Follow included instructions", "Place in sunny spot"]},
    {"name": "Plastic Nursery Pot Set (6 inch, 5 pcs)", "cat": "plastic-pots", "price": 199, "desc": "Durable black nursery pots with drainage holes.", "tags": ["plastic", "nursery", "drainage"], "care_tips": ["Great for repotting and starting plants"]},
    {"name": "Ceramic Planter Matte Black (6 inch)", "cat": "ceramic-pots", "price": 549, "desc": "Sleek matte black ceramic pot with saucer.", "tags": ["ceramic", "black", "modern"], "care_tips": ["Has drainage hole – use saucer indoors"]},
    {"name": "Iron Bucket Planter Rustic", "cat": "metal-planters", "price": 399, "desc": "Vintage-style galvanised iron bucket planter.", "tags": ["metal", "rustic", "vintage"], "care_tips": ["Drill drainage holes or use as cachepot"]},
    {"name": "Teak Wood Planter Box (12 inch)", "cat": "wooden-planters", "price": 1299, "desc": "Solid teak planter box, weather-resistant for outdoor use.", "tags": ["wooden", "teak", "outdoor"], "care_tips": ["Oil annually to maintain finish"]},
    {"name": "Rattan Hanging Basket (8 inch)", "cat": "hanging-planters", "price": 349, "desc": "Natural rattan basket with coconut coir liner.", "tags": ["hanging", "rattan", "natural"], "care_tips": ["Water slowly to prevent dripping"]},
    {"name": "Bamboo Plant Stand (3-Tier)", "cat": "plant-stands", "price": 1499, "desc": "Three-tier bamboo shelf for displaying multiple plants.", "tags": ["stand", "bamboo", "multi-tier"], "care_tips": ["Wipe with damp cloth", "Place on even surface"]},
    {"name": "Premium Potting Mix (10 litres)", "cat": "potting-mix-fertilizers", "price": 349, "desc": "Ready-to-use mix with cocopeat, perlite, and vermicompost.", "tags": ["potting-mix", "organic", "all-purpose"], "care_tips": ["Suitable for all indoor and outdoor plants"]},
    {"name": "3-Piece Garden Tool Set", "cat": "garden-tools", "price": 399, "desc": "Trowel, cultivator, and transplanter with wooden handles.", "tags": ["tools", "garden", "set"], "care_tips": ["Clean after each use to prevent rust"]},
    {"name": "Long Spout Watering Can (1.5L)", "cat": "watering-tools", "price": 449, "desc": "Precision long-spout can for indoor plants and seedlings.", "tags": ["tools", "watering", "indoor"], "care_tips": ["Copper finish – wipe dry to prevent water spots"]},
    {"name": "Organic Insecticidal Soap (500 ml)", "cat": "pest-control", "price": 249, "desc": "Kills aphids, mealybugs, and whiteflies on contact.", "tags": ["organic", "pest-control", "spray", "garden-services"], "care_tips": ["Spray undersides of leaves", "Apply in evening"]},
]


BLOG_POSTS = [
    {
        "title": "10 Types of Fertilizers That Help Grow Plants",
        "excerpt": "From vermicompost to liquid seaweed, understand which fertilizer works best for your garden and when to apply it.",
        "category": BlogCategory.GROW,
        "cover": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Choosing the Right Fertilizer

Plants need three primary nutrients: **Nitrogen (N)**, **Phosphorus (P)**, and **Potassium (K)**. Different fertilizers supply these in different ratios.

### Organic Fertilizers
1. **Vermicompost** — Worm castings rich in micronutrients. Great for all plants.
2. **Neem Cake** — Slow-release nitrogen + natural pest deterrent.
3. **Bone Meal** — High phosphorus; ideal for flowering plants and bulbs.
4. **Fish Emulsion** — Fast-acting liquid with balanced NPK.
5. **Seaweed Extract** — Packed with trace minerals and growth hormones.

### Synthetic Fertilizers
6. **NPK 19-19-19** — Balanced all-purpose granular feed.
7. **DAP (Diammonium Phosphate)** — Boosts root development.
8. **Urea** — Very high nitrogen; use sparingly for leafy greens.

### Specialty Options
9. **Epsom Salt** — Provides magnesium; great for tomatoes and roses.
10. **Coconut Husk Chips** — Slow-release potassium and improved aeration.

### When to Fertilize
- **Growing season** (March\u2013October): Feed every 2\u20134 weeks.
- **Winter**: Reduce or stop feeding \u2014 most plants are dormant.

Always water the soil before applying fertilizer to avoid root burn.""",
    },
    {
        "title": "13 Ways to Save Your Drying or Dead Plant",
        "excerpt": "Don't give up on your wilting houseplant just yet. Here are 13 proven techniques to revive even the most neglected greenery.",
        "category": BlogCategory.CARE,
        "cover": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Is Your Plant Dying? Here's How to Save It

Every plant parent has been there \u2014 yellowing leaves, drooping stems, dry soil. But most plants are more resilient than you think.

### 1. Check the Soil Moisture
Stick your finger 2 inches into the soil. Bone dry? Time for a deep soak. Soggy? You may be overwatering.

### 2. Inspect for Root Rot
Gently remove the plant from its pot. Healthy roots are white or tan; mushy brown roots mean rot. Trim the damaged ones with sterile scissors.

### 3. Adjust Your Watering Schedule
Most indoor plants prefer to dry out slightly between waterings. Set a weekly reminder rather than watering on a fixed schedule.

### 4. Move to Better Light
A plant that's stretching or losing colour likely needs more light. Shift it closer to a window, but avoid harsh afternoon sun.

### 5. Trim Dead Foliage
Removing yellow or brown leaves lets the plant redirect energy to new growth.

### 6\u201313: More Quick Wins
- **Repot** into fresh potting mix if the soil is compacted.
- **Mist** tropical plants to raise humidity.
- **Feed** with diluted liquid fertiliser during the growing season.
- **Check for pests** \u2014 look under leaves for mealybugs or spider mites.
- **Quarantine** infected plants away from healthy ones.
- **Reduce fertiliser** if leaf tips are burnt.
- **Prune leggy stems** to encourage bushier regrowth.
- **Be patient** \u2014 recovery takes 2\u20134 weeks.

With a little attention, most houseplants bounce back beautifully.""",
    },
    {
        "title": "How to Set Up a Balcony Garden",
        "excerpt": "Transform your apartment balcony into a lush green retreat with this step-by-step guide to container gardening.",
        "category": BlogCategory.DIY,
        "cover": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Your Balcony Garden, Step by Step

You don't need a backyard to be a gardener. A balcony \u2014 even a small one \u2014 can host a thriving container garden.

### Step 1: Assess Your Space
- **Direction**: South or west-facing gets the most sun.
- **Weight limit**: Check with your building \u2014 large pots filled with wet soil are heavy.
- **Wind exposure**: Higher floors may need wind barriers.

### Step 2: Choose the Right Containers
- Minimum **6-inch pots** for herbs; **10-12 inch** for vegetables and larger plants.
- Ensure every pot has **drainage holes**.
- Self-watering planters are ideal if you travel often.

### Step 3: Pick Your Plants
**Full Sun (6+ hours):** Tomatoes, chillies, bougainvillea, marigold.
**Part Shade (3\u20135 hours):** Money plant, ferns, lettuce, coriander.
**Low Light (indirect):** Snake plant, ZZ plant, pothos.

### Step 4: Soil & Feeding
Use a **quality potting mix** \u2014 not garden soil, which compacts in pots. Mix in cocopeat and perlite for better drainage.

### Step 5: Watering
- Water **early morning** or **late evening**.
- Check soil moisture daily in summer; every 2\u20133 days in winter.
- Mulch the surface with pebbles to reduce evaporation.

### Bonus: Vertical Gardening
Hang planters on railings, use wall-mounted pockets, or install a trellis for climbers like money plant or passion fruit.""",
    },
    {
        "title": "5 Plants That Purify Indoor Air",
        "excerpt": "NASA research shows these houseplants actively remove toxins like formaldehyde and benzene from your home.",
        "category": BlogCategory.TIPS,
        "cover": "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Breathe Easier with These Air-Purifying Plants

Indoor air can be 2\u20135 times more polluted than outdoor air. Houseplants are a natural, beautiful way to filter toxins.

### 1. Snake Plant (Sansevieria)
- **Removes:** Formaldehyde, benzene, trichloroethylene
- **Bonus:** Releases oxygen at night \u2014 perfect for bedrooms
- **Care:** Water every 2\u20133 weeks; tolerates low light

### 2. Peace Lily
- **Removes:** Ammonia, formaldehyde, benzene
- **Bonus:** Beautiful white blooms year-round
- **Care:** Keep soil moist; thrives in low to medium light

### 3. Areca Palm
- **Removes:** Formaldehyde, xylene, toluene
- **Bonus:** Acts as a natural humidifier
- **Care:** Bright indirect light; water twice weekly

### 4. Money Plant (Pothos)
- **Removes:** Formaldehyde, carbon monoxide
- **Bonus:** Nearly impossible to kill
- **Care:** Water weekly; grows in water or soil

### 5. Rubber Plant
- **Removes:** Formaldehyde
- **Bonus:** Large dramatic leaves make a design statement
- **Care:** Bright indirect light; wipe leaves monthly

### How Many Plants Do You Need?
NASA recommends **1 plant per 100 sq ft** for noticeable air quality improvement. A typical 2BHK apartment benefits from 6\u201310 plants.""",
    },
]


def _pick_images() -> list[str]:
    return random.sample(PLANT_IMAGES, k=random.randint(1, 3))


def _original_price(price: float) -> float:
    markup = random.uniform(1.15, 1.50)
    return round(price * markup)


async def seed(catalog_only: bool = False) -> None:
    if not async_session_factory or not engine:
        print("DATABASE_URL not set – skipping seed.")
        return
    async with async_session_factory() as db:
        # Clear in dependency order (children first, then parents)
        if catalog_only:
            # Re-seed only the catalog. Keeps banners, blog posts, users,
            # orders, addresses and carts. The rows that reference products
            # (cart items, order items, reviews, story links) must be cleared
            # because re-seeded products get new IDs.
            await db.execute(DamageClaim.__table__.update().values(order_item_id=None))
            await db.execute(OrderItem.__table__.delete())
            await db.execute(CartItem.__table__.delete())
            await db.execute(ProductReview.__table__.delete())
            await db.execute(Story.__table__.update().values(linked_product_id=None))
            await db.execute(Product.__table__.delete())
            await db.execute(Category.__table__.delete())
            await db.flush()
            print("Cleared categories + products (and rows referencing products).\n")
        else:
            await db.execute(DamageClaim.__table__.delete())
            await db.execute(CartItem.__table__.delete())
            await db.execute(Cart.__table__.delete())
            await db.execute(OrderItem.__table__.delete())
            await db.execute(Order.__table__.delete())
            await db.execute(Address.__table__.delete())
            await db.execute(ProductReview.__table__.delete())
            await db.execute(Banner.__table__.delete())
            await db.execute(Story.__table__.delete())
            await db.execute(Product.__table__.delete())
            await db.execute(Category.__table__.delete())
            await db.execute(BlogPost.__table__.delete())
            await db.execute(User.__table__.delete())
            await db.flush()
            print("Cleared existing data.\n")

            # Admin user
            admin = User(
                email="admin@example.com",
                hashed_password=hash_password("adminadmin"),
                full_name="Admin",
                is_active=True,
                is_admin=True,
            )
            db.add(admin)
            await db.flush()
            print(f"  Admin user: {admin.email} (id={admin.id})")

        slug_to_id: dict[str, int] = {}

        for cat_data in CATEGORIES:
            parent_id = cat_data.get("parent_id")
            parent_slug = cat_data.get("parent_slug")
            if parent_slug:
                parent_id = slug_to_id.get(parent_slug)

            cat = Category(
                name=cat_data["name"],
                slug=cat_data["slug"],
                parent_id=parent_id,
                image_url=UNSPLASH.format(id=CATEGORY_IMAGES[cat_data["slug"]]),
                is_active=True,
                sort_order=cat_data.get("sort_order", 0),
            )
            db.add(cat)
            await db.flush()
            await db.refresh(cat)
            slug_to_id[cat.slug] = cat.id
            print(f"  Category: {cat.name} (id={cat.id})")

        for p in PRODUCTS:
            cat_id = slug_to_id[p["cat"]]
            slug = p["name"].lower().strip()
            slug = re.sub(r"[^\w\s-]", "", slug)
            slug = re.sub(r"[\s_]+", "-", slug)
            slug = re.sub(r"-+", "-", slug).strip("-")

            variants = p.get("variants")
            if variants and "variant_groups" in variants:
                # New format: per-combination stock via dense stock_map.
                variants = _attach_stock_map(variants)
                stock_qty = sum(int(v or 0) for v in variants.get("stock_map", {}).values())
            else:
                stock_qty = random.randint(5, 200)

            product = Product(
                name=p["name"],
                slug=slug,
                description=p.get("desc", ""),
                price=p["price"],
                original_price=p["op"] if "op" in p else _original_price(p["price"]),
                stock_qty=stock_qty,
                category_id=cat_id,
                images=_pick_images(),
                tags=p.get("tags", []),
                care_tips=p.get("care_tips", []),
                sunlight=p.get("sunlight"),
                watering=p.get("watering"),
                badge=p.get("badge"),
                variants=variants,
                is_active=True,
            )
            db.add(product)

        if not catalog_only:
            for bp in BLOG_POSTS:
                slug = bp["title"].lower().strip()
                slug = re.sub(r"[^\w\s-]", "", slug)
                slug = re.sub(r"[\s_]+", "-", slug)
                slug = re.sub(r"-+", "-", slug).strip("-")

                post = BlogPost(
                    title=bp["title"],
                    slug=slug,
                    excerpt=bp["excerpt"],
                    content=bp["content"],
                    cover_image_url=bp["cover"],
                    category=bp["category"],
                    author_name=bp["author"],
                    is_published=True,
                    published_at=datetime.now(timezone.utc),
                )
                db.add(post)

            banners_seed = [
                Banner(
                    title="Get your first plant set!",
                    subtitle="Handpicked plants delivered to your door",
                    cta_text="Shop Now",
                    cta_link="/products",
                    badge_text="4 Plants @ ₹699",
                    placement="hero",
                    position=0,
                    bg_color="#F5F0E8",
                    text_color="#1B4332",
                    image_url="https://images.unsplash.com/photo-1545241047-6083a3684587?w=1400&h=600&fit=crop&crop=center",
                ),
                Banner(
                    title="Less care. More green.",
                    subtitle="Low-maintenance plants for your home.",
                    cta_text="Shop Plants",
                    cta_link="/products?tags=low-maintenance",
                    placement="hero",
                    position=1,
                    bg_color="#E8F0E8",
                    text_color="#1B4332",
                    image_url="https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1400&h=600&fit=crop&crop=center",
                ),
                Banner(
                    title="New to plants?",
                    subtitle="Start with the easy ones.",
                    cta_text="See Beginner Plants",
                    cta_link="/products?tags=beginner-friendly",
                    placement="hero",
                    position=2,
                    bg_color="#1B4332",
                    text_color="#FFFFFF",
                    image_url="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=600&fit=crop&crop=center",
                ),
                Banner(
                    title="Free Delivery Above ₹499 | Shop Now",
                    cta_link="/products",
                    placement="announcement",
                    position=0,
                    bg_color="#1B4332",
                    text_color="#FFFFFF",
                ),
                Banner(
                    title="Get 4 Plants @ just ₹699!",
                    cta_link="/products?tags=bundle",
                    placement="announcement",
                    position=1,
                    bg_color="#1B4332",
                    text_color="#FFFFFF",
                ),
                Banner(
                    title="Next-Day Delivery Available",
                    cta_link="/next-day-delivery",
                    placement="announcement",
                    position=2,
                    bg_color="#1B4332",
                    text_color="#FFFFFF",
                ),
                Banner(
                    title="Gardening ka full range. Sirf idhar milega!",
                    cta_link="/products",
                    placement="page",
                    position=0,
                    bg_color="#F4EFE5",
                    text_color="#1B4332",
                    image_url=UNSPLASH_BANNER.format(id="1416879595882-3373a0480b5b"),
                    target_path=None,  # global fallback — shown when no category-specific banner exists
                ),
                # ── Per-category page banners ──────────────────────────────────
                *(
                    Banner(
                        title=f"{name} – explore the range",
                        cta_link=f"/products?category={slug}",
                        placement="page",
                        position=0,
                        bg_color="#F4EFE5",
                        text_color="#1B4332",
                        image_url=UNSPLASH_BANNER.format(id=CATEGORY_IMAGES[slug]),
                        target_path=slug,
                    )
                    for slug, name in [
                        ("plants",                  "Plants"),
                        ("indoor-plants",           "Indoor Plants"),
                        ("outdoor-plants",          "Outdoor Plants"),
                        ("flowering-plants",        "Flowering Plants"),
                        ("cacti-succulents",        "Cacti & Succulents"),
                        ("xl-plants",               "XL Plants"),
                        ("low-maintenance-plants",  "Low Maintenance Plants"),
                        ("air-purifying-plants",    "Air Purifying Plants"),
                        ("hanging-plants",          "Hanging Plants"),
                        ("pet-friendly-plants",     "Pet-Friendly Plants"),
                        ("fruit-plants",            "Fruit Plants"),
                        ("seeds",                   "Seeds"),
                        ("vegetable-seeds",         "Vegetable Seeds"),
                        ("flower-seeds",            "Flower Seeds"),
                        ("microgreen-seeds",        "Microgreen Seeds"),
                        ("herb-seeds",              "Herb Seeds"),
                        ("flower-bulbs",            "Flower Bulbs"),
                        ("seeds-kits",              "Seeds Kits"),
                        ("pots-planters",           "Pots & Planters"),
                        ("plastic-pots",            "Plastic Pots"),
                        ("ceramic-pots",            "Ceramic Pots"),
                        ("metal-planters",          "Metal Planters"),
                        ("wooden-planters",         "Wooden Planters"),
                        ("hanging-planters",        "Hanging Planters"),
                        ("plant-stands",            "Plant Stands"),
                        ("plant-care",              "Plant Care"),
                        ("potting-mix-fertilizers", "Potting Mix & Fertilizers"),
                        ("garden-tools",            "Garden Tools"),
                        ("watering-tools",          "Watering Tools"),
                        ("pest-control",            "Pest Control"),
                    ]
                ),
            ]
            db.add_all(banners_seed)

            # Quick-access square tiles on the home page (placement "strip").
            # Category tiles reuse the seeded category thumbnails + links.
            strip_categories = [
                ("xl-plants", "XL Plants"),
                ("plant-stands", "Plant Stands"),
                ("plant-care", "Plant Care"),
                ("ceramic-pots", "Ceramic Pots"),
                ("watering-tools", "Watering Tools"),
                ("seeds", "Seeds"),
                ("air-purifying-plants", "Air Purifying Plants"),
            ]
            strip_banners = [
                Banner(
                    title="Next-Day\nDelivery",
                    cta_link="/products",
                    placement="strip",
                    position=0,
                    bg_color="#1B4332",
                    text_color="#A3E635",
                ),
                *(
                    Banner(
                        title=label,
                        cta_link=f"/products?category={slug}",
                        placement="strip",
                        position=pos,
                        bg_color="#F5F0E8",
                        text_color="#16A34A",
                        image_url=UNSPLASH.format(id=CATEGORY_IMAGES[slug]),
                    )
                    for pos, (slug, label) in enumerate(strip_categories, start=1)
                ),
            ]
            db.add_all(strip_banners)

        await db.commit()
        if catalog_only:
            print(
                f"\nSeeded {len(CATEGORIES)} categories and "
                f"{len(PRODUCTS)} products (everything else untouched)."
            )
        else:
            print(
                f"\nSeeded 1 admin, {len(CATEGORIES)} categories, "
                f"{len(PRODUCTS)} products, {len(BLOG_POSTS)} blog posts, "
                f"and {len(banners_seed) + len(strip_banners)} banners."
            )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed the Plantoga database.")
    parser.add_argument(
        "--only-catalog",
        action="store_true",
        help="Re-seed only categories + products; leave banners, blog posts, "
        "users, carts, orders and addresses untouched.",
    )
    args = parser.parse_args()
    asyncio.run(seed(catalog_only=args.only_catalog))
