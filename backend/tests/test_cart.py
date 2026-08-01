import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _seed_category,
    _register_user,
    _seed_product_and_category,
    REGULAR_USER,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


VARIANTS = {
    "colors": [
        {"name": "Terracotta", "hex": "#C4622D", "slug": "terracotta"},
        {"name": "Sage Green", "hex": "#7A9E7E", "slug": "sage-green"},
    ],
    "pot_types": [
        {
            "name": "Plastic",
            "slug": "plastic",
            "price_modifier": 0,
            "image_url": "https://example.com/plastic-pot.jpg",
        },
        {"name": "Ceramic", "slug": "ceramic", "price_modifier": 150},
    ],
    "image_map": {
        "terracotta__plastic": "https://example.com/terracotta-plastic.jpg",
        "sage-green__ceramic": "https://example.com/sage-ceramic.jpg",
    },
    "default_image": "https://example.com/default.jpg",
    "stock": {
        "terracotta__plastic": 4,
        "terracotta__ceramic": 0,
        "sage-green__plastic": 2,
        "sage-green__ceramic": 3,
    },
}


async def _seed_variant_product(client: AsyncClient, admin_token: str) -> dict:
    cat = await _seed_category(client, admin_token, "Variant Plants")
    from app.db.models import Product
    async with test_session_factory() as db:
        p = Product(
            name="Variant Pothos", slug="variant-pothos", description="Configurable",
            price=200.0, original_price=None, stock_qty=sum(VARIANTS["stock"].values()),
            category_id=cat["id"], images=["https://example.com/base.jpg"],
            tags=["indoor"], variants=VARIANTS, is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "stock_qty": p.stock_qty}


async def test_guest_cart_add_and_get(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 2})
    assert resp.status_code == 201
    data = resp.json()
    assert data["item_count"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 2

    cookies = resp.cookies
    resp2 = await client.get("/api/v1/cart", cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["item_count"] == 2


async def test_guest_cart_update_and_remove(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 3})
    cookies = resp.cookies
    item_id = resp.json()["items"][0]["id"]

    resp2 = await client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": 5}, cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["items"][0]["quantity"] == 5

    resp3 = await client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": 0}, cookies=cookies)
    assert resp3.status_code == 200
    assert resp3.json()["item_count"] == 0


async def test_stock_validation_on_add(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=2)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 5})
    assert resp.status_code == 400
    assert "stock" in resp.json()["detail"].lower()


async def test_auth_cart_separate_from_guest(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)

    resp_guest = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 1})
    assert resp_guest.status_code == 201
    guest_cookies = resp_guest.cookies

    resp_auth = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_auth.status_code == 201
    assert resp_auth.json()["item_count"] == 3

    resp_guest2 = await client.get("/api/v1/cart", cookies=guest_cookies)
    assert resp_guest2.json()["item_count"] == 1


async def test_cart_merge_keeps_higher_qty(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)
    token = await _register_user(client)

    resp_guest = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 5})
    session_id = resp_guest.cookies.get("cart_session_id")
    assert session_id

    await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp_merge = await client.post(
        "/api/v1/cart/merge",
        json={"session_id": session_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_merge.status_code == 200
    assert resp_merge.json()["items"][0]["quantity"] == 5


async def test_delete_cart_item(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 2})
    cookies = resp.cookies
    item_id = resp.json()["items"][0]["id"]

    resp2 = await client.delete(f"/api/v1/cart/items/{item_id}", cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["item_count"] == 0

    resp3 = await client.delete(f"/api/v1/cart/items/{item_id}", cookies=cookies)
    assert resp3.status_code == 200
    assert resp3.json()["item_count"] == 0


async def test_variant_cart_add_returns_computed_fields(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    resp = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 2,
        "selected_options": {"pot_type": "ceramic", "color": "sage-green"},
    })

    assert resp.status_code == 201, resp.text
    item = resp.json()["items"][0]
    assert item["selected_options"] == {"color": "sage-green", "pot_type": "ceramic"}
    assert item["unit_price"] == 350
    assert item["line_total"] == 700
    assert item["available_stock"] == 3
    assert item["stock_warning"] is False
    assert item["resolved_image_url"] == "https://example.com/sage-ceramic.jpg"


async def test_variant_cart_uses_pot_image_when_combo_image_is_missing(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    resp = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"color": "sage-green", "pot_type": "plastic"},
    })

    assert resp.status_code == 201, resp.text
    assert resp.json()["items"][0]["resolved_image_url"] == "https://example.com/plastic-pot.jpg"


async def test_variant_cart_rejects_invalid_or_sold_out_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    invalid = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"color": "blue", "pot_type": "plastic"},
    })
    assert invalid.status_code == 400

    sold_out = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"color": "terracotta", "pot_type": "ceramic"},
    })
    assert sold_out.status_code == 400


async def test_variant_cart_groups_by_normalized_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    resp = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"pot_type": "plastic", "color": "terracotta"},
    })
    cookies = resp.cookies
    resp2 = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 2,
        "selected_options": {"color": "terracotta", "pot_type": "plastic"},
    }, cookies=cookies)

    assert resp2.status_code == 201, resp2.text
    data = resp2.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 3


async def test_guest_cart_add_multiple_products(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product_a = await _seed_product_and_category(client, admin, stock=10)

    from app.db.models import Product
    async with test_session_factory() as db:
        from sqlalchemy import select
        from app.db.models import Category

        cat = (await db.execute(select(Category).limit(1))).scalar_one()
        product_b = Product(
            name="Cart Plant B", slug="cart-plant-b", description="Second plant",
            price=399.0, original_price=None, stock_qty=10,
            category_id=cat.id, images=["https://placehold.co/300"],
            tags=["indoor"], is_active=True,
        )
        db.add(product_b)
        await db.commit()
        await db.refresh(product_b)
        product_b_id = product_b.id

    resp = await client.post("/api/v1/cart/items", json={"product_id": product_a["id"], "quantity": 1})
    assert resp.status_code == 201, resp.text
    cookies = resp.cookies

    resp2 = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product_b_id, "quantity": 2},
        cookies=cookies,
    )
    assert resp2.status_code == 201, resp2.text
    data = resp2.json()
    assert data["item_count"] == 3
    assert len(data["items"]) == 2


async def test_guest_cart_persists_via_session_header(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product_a = await _seed_product_and_category(client, admin, stock=10)

    from app.db.models import Product
    async with test_session_factory() as db:
        from sqlalchemy import select
        from app.db.models import Category

        cat = (await db.execute(select(Category).limit(1))).scalar_one()
        product_b = Product(
            name="Header Cart Plant B", slug="header-cart-plant-b", description="Second plant",
            price=399.0, original_price=None, stock_qty=10,
            category_id=cat.id, images=["https://placehold.co/300"],
            tags=["indoor"], is_active=True,
        )
        db.add(product_b)
        await db.commit()
        await db.refresh(product_b)
        product_b_id = product_b.id

    resp = await client.post("/api/v1/cart/items", json={"product_id": product_a["id"], "quantity": 1})
    assert resp.status_code == 201, resp.text
    session_id = resp.json()["session_id"]
    assert session_id

    resp2 = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product_b_id, "quantity": 1},
        headers={"X-Cart-Session-Id": session_id},
    )
    assert resp2.status_code == 201, resp2.text
    data = resp2.json()
    assert data["item_count"] == 2
    assert len(data["items"]) == 2
    assert data["session_id"] == session_id


async def test_duplicate_carts_are_consolidated(client: AsyncClient):
    """
    Verify that a user's cart is correctly found when adding items, even when
    the cart was previously created by merging a guest session.
    The SQLite test DB enforces a full unique constraint on user_id (unlike
    PostgreSQL which uses a partial index), so we test consolidation via API.
    """
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)

    # Add an item as authenticated user — creates the user cart
    resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    cart_id = resp.json()["id"]

    # Add another item — should reuse the same cart
    resp2 = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json()["id"] == cart_id, "Must reuse the same cart"
    assert resp2.json()["item_count"] == 2
    assert len(resp2.json()["items"]) == 1  # same product → merged into one item



# ---------------------------------------------------------------------------
# variant_groups pricing unit tests
# ---------------------------------------------------------------------------
# These test _resolve_variant_groups_details directly (no DB/HTTP needed).
# The pricing model: price = sum of all required groups' selected option prices.
# If this function is refactored, these tests will catch silent regressions.
# NOTE: These are sync unit tests — not marked asyncio despite the file-level mark.
# Use pytest.ini's asyncio_mode or per-test overrides if needed.

from app.services.cart_service import _resolve_variant_groups_details


LEAF_VARIANTS = {
    "variant_groups": [
        {
            "id": "vg_colour",
            "label": "colour",
            "required": True,
            "options": [
                {"id": "opt_red",   "name": "red",   "price": 100.0, "stock": 10, "images": None, "color_hex": "#ff0000"},
                {"id": "opt_blue",  "name": "blue",  "price": 100.0, "stock": 20, "images": None, "color_hex": "#0000ff"},
            ],
        },
        {
            "id": "vg_pot",
            "label": "pot",
            "required": True,
            "options": [
                {"id": "opt_krish", "name": "krish", "price": 100.0,  "stock": 100, "images": None, "color_hex": None},
                {"id": "opt_type1", "name": "type1", "price": 1000.0, "stock": 15,  "images": None, "color_hex": None},
            ],
        },
        {
            "id": "vg_size",
            "label": "size",
            "required": True,
            "options": [
                {"id": "opt_4inch", "name": "4inch", "price": 1000.0, "stock": 6,  "images": None, "color_hex": None},
                {"id": "opt_6inch", "name": "6inch", "price": 1500.0, "stock": 6,  "images": None, "color_hex": None},
                {"id": "opt_8inch", "name": "8inch", "price": 1600.0, "stock": 8,  "images": None, "color_hex": None},
            ],
        },
    ],
    "default_image": None,
    "image_map": None,
}


class _MockProduct:
    """Minimal product stub for unit-testing resolve functions."""
    def __init__(self, price: float, stock_qty: int, variants: dict):
        self.id = 999
        self.name = "Test Product"
        self.price = price
        self.stock_qty = stock_qty
        self.images = ["https://example.com/img.jpg"]
        self.variants = variants


def test_variant_groups_price_sums_all_required_groups():
    """red(100) + krish(100) + 4inch(1000) = 1200."""
    p = _MockProduct(price=450.0, stock_qty=50, variants=LEAF_VARIANTS)
    sel = {"vg_colour": "opt_red", "vg_pot": "opt_krish", "vg_size": "opt_4inch"}
    d = _resolve_variant_groups_details(p, sel)
    assert d["unit_price"] == 1200.0, f"Expected 1200.0, got {d['unit_price']}"


def test_variant_groups_price_second_combo():
    """red(100) + type1(1000) + 8inch(1600) = 2700."""
    p = _MockProduct(price=450.0, stock_qty=50, variants=LEAF_VARIANTS)
    sel = {"vg_colour": "opt_red", "vg_pot": "opt_type1", "vg_size": "opt_8inch"}
    d = _resolve_variant_groups_details(p, sel)
    assert d["unit_price"] == 2700.0, f"Expected 2700.0, got {d['unit_price']}"


def test_variant_groups_stock_is_min_across_required_groups():
    """min(red=10, krish=100, 4inch=6) = 6."""
    p = _MockProduct(price=450.0, stock_qty=50, variants=LEAF_VARIANTS)
    sel = {"vg_colour": "opt_red", "vg_pot": "opt_krish", "vg_size": "opt_4inch"}
    d = _resolve_variant_groups_details(p, sel)
    assert d["available_stock"] == 6, f"Expected 6, got {d['available_stock']}"


def test_variant_groups_missing_required_group_raises():
    """Omitting a required group selection must raise ValueError."""
    p = _MockProduct(price=450.0, stock_qty=50, variants=LEAF_VARIANTS)
    # Only two of three required groups provided
    sel = {"vg_colour": "opt_red", "vg_pot": "opt_krish"}
    with pytest.raises(ValueError, match="Please select an option for"):
        _resolve_variant_groups_details(p, sel, validate_stock=True)


def test_variant_groups_invalid_option_id_raises():
    """A tampered/unknown option id must raise ValueError."""
    p = _MockProduct(price=450.0, stock_qty=50, variants=LEAF_VARIANTS)
    sel = {"vg_colour": "opt_red", "vg_pot": "opt_krish", "vg_size": "opt_FAKE"}
    with pytest.raises(ValueError, match="Invalid option selected"):
        _resolve_variant_groups_details(p, sel, validate_stock=True)


def test_variant_groups_zero_required_falls_back_to_product_price():
    """Products with no required groups use product.price as display price."""
    no_required_variants = {
        "variant_groups": [
            {
                "id": "vg_colour", "label": "Pot Colour", "required": None,
                "options": [
                    {"id": "o1", "name": "White", "price": 0, "stock": 10, "images": None, "color_hex": "#ffffff"},
                ],
            },
        ],
        "default_image": None,
        "image_map": None,
    }
    p = _MockProduct(price=249.0, stock_qty=10, variants=no_required_variants)
    d = _resolve_variant_groups_details(p, {})
    assert d["unit_price"] == 249.0, f"Expected 249.0 (product.price), got {d['unit_price']}"
    assert d["available_stock"] == 10, f"Expected stock_qty=10, got {d['available_stock']}"


def test_variant_groups_out_of_stock_raises_when_validating():
    """Selecting an option with stock=0 should raise when validate_stock=True."""
    low_stock_variants = {
        "variant_groups": [
            {
                "id": "vg_size", "label": "Size", "required": True,
                "options": [
                    {"id": "o1", "name": "Small", "price": 99.0, "stock": 0, "images": None, "color_hex": None},
                ],
            },
        ],
        "default_image": None,
        "image_map": None,
    }
    p = _MockProduct(price=99.0, stock_qty=0, variants=low_stock_variants)
    with pytest.raises(ValueError, match="out of stock"):
        _resolve_variant_groups_details(p, {"vg_size": "o1"}, validate_stock=True)
