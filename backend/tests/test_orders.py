import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_address,
    _seed_category,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


ORDER_VARIANTS = {
    "colors": [
        {"name": "Terracotta", "hex": "#C4622D", "slug": "terracotta"},
        {"name": "Sage Green", "hex": "#7A9E7E", "slug": "sage-green"},
    ],
    "pot_types": [
        {"name": "Plastic", "slug": "plastic", "price_modifier": 0},
        {"name": "Ceramic", "slug": "ceramic", "price_modifier": 150},
    ],
    "image_map": {
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
    cat = await _seed_category(client, admin_token, "Order Variant Plants")
    from app.db.models import Product
    async with test_session_factory() as db:
        p = Product(
            name="Order Variant Pothos", slug="order-variant-pothos", description="Configurable",
            price=200.0, original_price=None, stock_qty=sum(ORDER_VARIANTS["stock"].values()),
            category_id=cat["id"], images=["https://example.com/base.jpg"],
            tags=["indoor"], variants=ORDER_VARIANTS, is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "stock_qty": p.stock_qty}


async def _setup_cart(client: AsyncClient, token: str, product_id: int, quantity: int = 2) -> int:
    resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product_id, "quantity": quantity},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_checkout_success(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=2)

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_id"] > 0
    assert "razorpay_order_data" in data
    assert data["razorpay_order_data"] is not None


async def test_checkout_cod_skips_razorpay_and_records_payment_method(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.WHATSAPP_ACCESS_TOKEN", "")
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id, "payment_method": "cod"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["order_id"] > 0
    assert data["razorpay_order_data"] is None

    detail_resp = await client.get(
        f"/api/v1/orders/{data['order_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["payment_method"] == "cod"
    assert detail["payment_status"] == "pending"


async def test_checkout_clears_cart(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get("/api/v1/cart", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["item_count"] == 0


async def test_checkout_insufficient_stock(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=1)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    # Drain the stock by direct DB update so checkout fails
    from sqlalchemy import update

    from app.db.models import Product
    from tests.conftest import test_session_factory
    async with test_session_factory() as db:
        await db.execute(update(Product).where(Product.id == product["id"]).values(stock_qty=0))
        await db.commit()

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "stock" in resp.json()["detail"].lower()


async def test_checkout_empty_cart(client: AsyncClient):
    await _register_and_make_admin(client)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    # Create an empty cart
    resp = await client.get("/api/v1/cart", headers={"Authorization": f"Bearer {token}"})
    cart_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_order_list_and_detail(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=2)

    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    order_id = checkout_resp.json()["order_id"]

    list_resp = await client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 1

    detail_resp = await client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == order_id
    assert len(detail_resp.json()["items"]) == 1


async def test_checkout_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/orders/checkout", json={"address_id": 1, "cart_id": 1})
    assert resp.status_code == 401


async def test_variant_checkout_decrements_combo_stock_and_snapshots_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    add_resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 2,
            "selected_options": {"color": "sage-green", "pot_type": "ceramic"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 201, add_resp.text
    cart_id = add_resp.json()["id"]

    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert checkout_resp.status_code == 201, checkout_resp.text
    order_id = checkout_resp.json()["order_id"]

    detail_resp = await client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    item = detail_resp.json()["items"][0]
    assert item["unit_price"] == 350
    assert item["selected_options"] == {"color": "sage-green", "pot_type": "ceramic"}
    assert item["resolved_image_url"] == "https://example.com/sage-ceramic.jpg"

    from app.db.models import Product
    async with test_session_factory() as db:
        db_product = await db.get(Product, product["id"])
        assert db_product.variants["stock"]["sage-green__ceramic"] == 1
        assert db_product.stock_qty == sum(db_product.variants["stock"].values())


# ---------------------------------------------------------------------------
# New-format (variant_groups) per-combination stock_map reservation
# ---------------------------------------------------------------------------

from app.utils.variant_pricing import build_dense_stock_map  # noqa: E402


def _new_format_variants() -> dict:
    groups = [
        {
            "id": "vg_size",
            "label": "Select Size",
            "required": True,
            "options": [
                {"id": "opt_small",  "name": "Small",  "price": 200, "stock": 5},
                {"id": "opt_medium", "name": "Medium", "price": 300, "stock": 3},
            ],
        },
        {
            "id": "vg_colour",
            "label": "Select Colour",
            "required": True,
            "options": [
                {"id": "opt_black", "name": "Black", "price": 0, "stock": 10},
                {"id": "opt_white", "name": "White", "price": 0, "stock": 0},
            ],
        },
    ]
    return {
        "variant_groups": groups,
        "default_image": None,
        "image_map": None,
        "stock_map": build_dense_stock_map(groups),
    }


async def _seed_new_format_variant_product(client: AsyncClient, admin_token: str, stock_map: dict | None = None) -> dict:
    cat = await _seed_category(client, admin_token, "New Format Variant Plants")
    from app.db.models import Product
    variants = _new_format_variants()
    if stock_map is not None:
        variants = {**variants, "stock_map": stock_map}
    async with test_session_factory() as db:
        p = Product(
            name="New Format Pothos", slug="new-format-pothos", description="Configurable",
            price=200.0, original_price=None,
            stock_qty=sum(variants["stock_map"].values()),
            category_id=cat["id"], images=["https://example.com/base.jpg"],
            tags=["indoor"], variants=variants, is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "stock_qty": p.stock_qty}


async def test_new_format_checkout_decrements_exact_combo_row(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_new_format_variant_product(client, admin)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    # Buy 2 of (Small, Black) — the only in-stock combo (White option has stock 0,
    # so min(3, 0) = 0 makes every White combo 0 in the dense map).
    add_resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 2,
            "selected_options": ["opt_small", "opt_black"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 201, add_resp.text
    cart_id = add_resp.json()["id"]

    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert checkout_resp.status_code == 201, checkout_resp.text

    from app.db.models import Product
    async with test_session_factory() as db:
        db_product = await db.get(Product, product["id"])
        sm = db_product.variants["stock_map"]
        # Only the matched combo row is decremented; others untouched.
        assert sm["opt_small__opt_black"] == 3   # 5 - 2
        assert sm["opt_small__opt_white"] == 0
        assert sm["opt_medium__opt_black"] == 3
        assert sm["opt_medium__opt_white"] == 0
        assert db_product.stock_qty == sum(sm.values())


async def test_new_format_cart_validates_against_stock_map(client: AsyncClient):
    """Adding more than a combo row's stock must fail at cart time."""
    admin = await _register_and_make_admin(client)
    product = await _seed_new_format_variant_product(client, admin)
    token = await _register_user(client)

    add_resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 6,  # small/black has 5
            "selected_options": ["opt_small", "opt_black"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 400, add_resp.text
    assert "stock" in add_resp.json()["detail"].lower()


async def test_new_format_partial_selection_is_clear_400(client: AsyncClient):
    """Leaving any group unselected (required or not) is an incomplete-configuration
    400 with an actionable message — never a StockMapMissingError 500."""
    admin = await _register_and_make_admin(client)
    product = await _seed_new_format_variant_product(client, admin)
    token = await _register_user(client)

    resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 1,
            "selected_options": ["opt_small"],  # missing the colour group
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text
    assert "Please select an option" in resp.json()["detail"]


async def test_new_format_missing_stock_map_returns_500_stock_map_missing(client: AsyncClient):
    """A variant_groups product without a stock_map is a deployment bug → loud 500
    with the STOCK_MAP_MISSING code (must not be flattened into a 400)."""
    admin = await _register_and_make_admin(client)
    product = await _seed_new_format_variant_product(client, admin)

    # Simulate a product that never got the migration: strip its stock_map.
    from sqlalchemy.orm.attributes import flag_modified

    from app.db.models import Product
    async with test_session_factory() as db:
        p = await db.get(Product, product["id"])
        p.variants.pop("stock_map", None)
        flag_modified(p, "variants")
        await db.commit()

    token = await _register_user(client)
    resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 1,
            "selected_options": ["opt_small", "opt_black"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 500, resp.text
    assert resp.json()["detail"] == "STOCK_MAP_MISSING"


async def test_new_format_cart_payload_available_stock_reflects_stock_map(client: AsyncClient):
    """Cart GET must surface the per-combo stock — not a per-option min — as available_stock."""
    admin = await _register_and_make_admin(client)
    # Rows deliberately differ from the per-option min:
    #   (small, black)  row 3   option-min min(5, 10) = 5
    #   (medium, black) row 7   option-min min(3, 10) = 3
    custom_map = {
        "opt_small__opt_black": 3,
        "opt_small__opt_white": 0,
        "opt_medium__opt_black": 7,
        "opt_medium__opt_white": 0,
    }
    product = await _seed_new_format_variant_product(client, admin, stock_map=custom_map)
    token = await _register_user(client)

    add_resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 2,
            "selected_options": ["opt_small", "opt_black"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 201, add_resp.text

    cart_resp = await client.get("/api/v1/cart", headers={"Authorization": f"Bearer {token}"})
    assert cart_resp.status_code == 200, cart_resp.text
    item = cart_resp.json()["items"][0]
    # Reads stock_map row (3), not option-min (5) — would fail if per-option stock leaked.
    assert item["available_stock"] == 3
    assert item["stock_warning"] is False


