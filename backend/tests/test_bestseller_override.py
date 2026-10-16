"""Per-product bestseller badge override — wording and colour, product by product.

The bestseller badge is configured per category (`category_badge_configs`). That
makes renaming it for a whole category easy but renaming it for ONE product
impossible. These tests pin the per-product exception layer on top: two nullable
columns where NULL means "follow the category", saved independently so a product
can be renamed without being recoloured, and cleared by sending null.

The rendering rules that consume these values live in the frontend
(`lib/bestsellerBadge.ts`); what is testable here is that the values survive the
round trip through every product endpoint without being lost, mangled or
silently dropped.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import _seed_category, test_session_factory

PRODUCTS_URL = "/api/v1/products"


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _seed_bestseller(client: AsyncClient, admin_token: str, name: str = "Money Plant") -> dict:
    """A product already flagged as a bestseller, created via the admin API."""
    cat = await _seed_category(client, admin_token, "Test Plants")
    resp = await client.post(
        PRODUCTS_URL,
        data={
            "name": name,
            "price": "499",
            "category_id": str(cat["id"]),
            "is_bestseller": "true",
        },
        headers=auth(admin_token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _put(client: AsyncClient, admin_token: str, product_id: int, **body) -> AsyncClient:
    return await client.put(f"{PRODUCTS_URL}/{product_id}", json=body, headers=auth(admin_token))


async def test_create_accepts_is_bestseller_from_the_admin_form(
    client: AsyncClient, admin_token: str
):
    """Regression: the create form has always submitted `is_bestseller`, but the
    endpoint never declared it, so FastAPI dropped it and every newly registered
    product landed with the flag off. A product registered as a bestseller must
    actually be one."""
    product = await _seed_bestseller(client, admin_token)
    assert product["is_bestseller"] is True


async def test_override_is_returned_on_the_public_product(
    client: AsyncClient, admin_token: str
):
    """The storefront resolves the badge from the product payload, so the override
    has to be on the public product response — not only in the admin raw payload."""
    product = await _seed_bestseller(client, admin_token)

    assert product["bestseller_label_override"] is None
    assert product["bestseller_color_override"] is None

    await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="HOT SELLER",
        bestseller_color_override="#E11D48",
    )

    resp = await client.get(f"{PRODUCTS_URL}/{product['slug']}")
    assert resp.status_code == 200
    assert resp.json()["bestseller_label_override"] == "HOT SELLER"
    assert resp.json()["bestseller_color_override"] == "#E11D48"


async def test_override_is_returned_on_the_product_list(
    client: AsyncClient, admin_token: str
):
    """Product cards are fed by the list endpoint, so an override missing here
    would render on the detail page but not in the grid."""
    product = await _seed_bestseller(client, admin_token)
    await _put(client, admin_token, product["id"], bestseller_label_override="HOT SELLER")

    resp = await client.get(PRODUCTS_URL)
    assert resp.status_code == 200
    item = next(p for p in resp.json()["items"] if p["id"] == product["id"])
    assert item["bestseller_label_override"] == "HOT SELLER"


async def test_raw_admin_endpoint_includes_overrides(
    client: AsyncClient, admin_token: str
):
    """The raw admin endpoint is a hand-rolled serializer rather than
    `ProductResponse`. If it is not updated the edit form seeds blank fields and
    the next save silently wipes the override."""
    product = await _seed_bestseller(client, admin_token)
    await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="HOT SELLER",
        bestseller_color_override="#E11D48",
    )

    resp = await client.get(f"{PRODUCTS_URL}/admin/{product['id']}/raw", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["bestseller_label_override"] == "HOT SELLER"
    assert body["bestseller_color_override"] == "#E11D48"


async def test_the_two_halves_are_independent(
    client: AsyncClient, admin_token: str
):
    """A rename-only override must not force a colour, and vice versa.

    Each half has three reachable states, so all three are exercised:
      omitted → keep whatever was saved
      null    → clear it, leaving the other half alone
      value   → set it, leaving the other half alone
    """
    product = await _seed_bestseller(client, admin_token)

    # Rename only: the colour half is untouched, so it stays "not overridden".
    await _put(client, admin_token, product["id"], bestseller_label_override="HOT SELLER")
    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] == "HOT SELLER"
    assert body["bestseller_color_override"] is None

    # Recolor only: omitting the label key leaves the rename in place, so both
    # halves can end up set by two separate edits.
    await _put(client, admin_token, product["id"], bestseller_color_override="#E11D48")
    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] == "HOT SELLER"
    assert body["bestseller_color_override"] == "#E11D48"

    # Clearing one half leaves the other standing.
    await _put(client, admin_token, product["id"], bestseller_label_override=None)
    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] is None
    assert body["bestseller_color_override"] == "#E11D48"


async def test_null_clears_the_override(client: AsyncClient, admin_token: str):
    """The admin form's "Use category settings" must actually remove it."""
    product = await _seed_bestseller(client, admin_token)
    await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="HOT SELLER",
        bestseller_color_override="#E11D48",
    )

    resp = await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override=None,
        bestseller_color_override=None,
    )
    assert resp.status_code == 200, resp.text

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] is None
    assert body["bestseller_color_override"] is None


async def test_omitting_a_field_preserves_the_saved_override(
    client: AsyncClient, admin_token: str
):
    """The update endpoint uses `exclude_unset`, so an absent key means "leave it
    alone" rather than "clear it"."""
    product = await _seed_bestseller(client, admin_token)
    await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="HOT SELLER",
        bestseller_color_override="#E11D48",
    )

    # A completely unrelated edit must not disturb the override.
    await _put(client, admin_token, product["id"], stock_qty=42)

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] == "HOT SELLER"
    assert body["bestseller_color_override"] == "#E11D48"
    assert body["stock_qty"] == 42


async def test_blank_values_are_stored_as_no_override(
    client: AsyncClient, admin_token: str
):
    """Clearing a text input submits "". Storing that would leave a product whose
    override renders as an empty badge."""
    product = await _seed_bestseller(client, admin_token)

    resp = await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="   ",
        bestseller_color_override="",
    )
    assert resp.status_code == 200, resp.text

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] is None
    assert body["bestseller_color_override"] is None


async def test_label_is_trimmed(client: AsyncClient, admin_token: str):
    product = await _seed_bestseller(client, admin_token)
    await _put(client, admin_token, product["id"], bestseller_label_override="  Hot Seller  ")

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["bestseller_label_override"] == "Hot Seller"


@pytest.mark.parametrize("colour", ["red", "#FFF", "#GGGGGG", "F59E0B"])
async def test_colour_is_validated(
    client: AsyncClient, admin_token: str, colour: str
):
    """Same rule as the category config's badge colours, so a colour that the
    Image Badges page accepts is not rejected here."""
    product = await _seed_bestseller(client, admin_token)
    resp = await _put(client, admin_token, product["id"], bestseller_color_override=colour)
    assert resp.status_code == 422, resp.text


async def test_label_over_fifty_chars_is_rejected(
    client: AsyncClient, admin_token: str
):
    """Mirrors the category config's 50-character cap, so the two editors behave
    the same way."""
    product = await _seed_bestseller(client, admin_token)
    resp = await _put(client, admin_token, product["id"], bestseller_label_override="x" * 51)
    assert resp.status_code == 422


async def test_label_at_fifty_chars_is_accepted(client: AsyncClient, admin_token: str):
    product = await _seed_bestseller(client, admin_token)
    resp = await _put(client, admin_token, product["id"], bestseller_label_override="x" * 50)
    assert resp.status_code == 200


async def test_create_with_form_data_saves_the_override(
    client: AsyncClient, admin_token: str
):
    """The create path is multipart FormData, so it is a different code path from
    the JSON update above."""
    cat = await _seed_category(client, admin_token, "FormData Plants")
    resp = await client.post(
        PRODUCTS_URL,
        data={
            "name": "Form Plant",
            "price": "299",
            "category_id": str(cat["id"]),
            "is_bestseller": "true",
            "bestseller_label_override": "HOT SELLER",
            "bestseller_color_override": "#E11D48",
        },
        headers=auth(admin_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["bestseller_label_override"] == "HOT SELLER"
    assert body["bestseller_color_override"] == "#E11D48"


async def test_create_without_the_override_keys_leaves_them_null(
    client: AsyncClient, admin_token: str
):
    """The admin form omits both keys when nothing is overridden, so "absent"
    must mean no override rather than a validation failure."""
    cat = await _seed_category(client, admin_token, "Plain Plants")
    resp = await client.post(
        PRODUCTS_URL,
        data={"name": "Plain Plant", "price": "199", "category_id": str(cat["id"])},
        headers=auth(admin_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["bestseller_label_override"] is None
    assert body["bestseller_color_override"] is None
    assert body["is_bestseller"] is False


async def test_override_survives_a_category_change(
    client: AsyncClient, admin_token: str
):
    """A product override is product-wide, not tied to the category it was set
    against. Moving the product to another category must not drop it — the
    category only supplies the fallback for the halves left unset."""
    product = await _seed_bestseller(client, admin_token)
    other = await _seed_category(client, admin_token, "Other Plants")

    await _put(
        client,
        admin_token,
        product["id"],
        category_id=other["id"],
        bestseller_label_override="HOT SELLER",
    )

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["category_id"] == other["id"]
    assert body["bestseller_label_override"] == "HOT SELLER"


async def test_writes_require_admin(client: AsyncClient, admin_token: str, user_token: str):
    product = await _seed_bestseller(client, admin_token)
    resp = await client.put(
        f"{PRODUCTS_URL}/{product['id']}",
        json={"bestseller_label_override": "HOT SELLER"},
        headers=auth(user_token),
    )
    assert resp.status_code in (401, 403)


async def test_update_invalidates_the_product_cache(
    client: AsyncClient, admin_token: str
):
    """A renamed badge must reach the storefront on the next read rather than
    after the cache TTL: the product list and detail payloads are cached, and a
    stale one means the admin saves and sees the old wording."""
    product = await _seed_bestseller(client, admin_token)

    # Prime both caches with the pre-override payload.
    await client.get(PRODUCTS_URL)
    await client.get(f"{PRODUCTS_URL}/{product['slug']}")

    await _put(client, admin_token, product["id"], bestseller_label_override="HOT SELLER")

    detail = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert detail["bestseller_label_override"] == "HOT SELLER"

    listing = (await client.get(PRODUCTS_URL)).json()
    item = next(p for p in listing["items"] if p["id"] == product["id"])
    assert item["bestseller_label_override"] == "HOT SELLER"


async def test_override_does_not_disturb_the_category_config(
    client: AsyncClient, admin_token: str
):
    """A product override is an exception, not a category edit: it must never
    appear in the badge-config map the storefront resolves categories against."""
    product = await _seed_bestseller(client, admin_token)
    cat_id = product["category_id"]

    await _put(
        client,
        admin_token,
        product["id"],
        bestseller_label_override="HOT SELLER",
        bestseller_color_override="#E11D48",
    )

    body = (await client.get("/api/v1/badge-configs")).json()
    effective = body["effective_by_category"][str(cat_id)]
    assert effective["bestseller"]["label"] == "BESTSELLER"
    assert effective["bestseller"]["color"] == "#F59E0B"


async def test_bestseller_flag_is_untouched_by_the_override(
    client: AsyncClient, admin_token: str
):
    """An override only decides the wording and colour. Whether the badge is
    drawn at all stays with `is_bestseller`, so a product must not acquire the
    badge just by being renamed."""
    product = await _seed_bestseller(client, admin_token)
    await _put(client, admin_token, product["id"], bestseller_label_override="HOT SELLER")

    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["is_bestseller"] is True

    await _put(client, admin_token, product["id"], is_bestseller=False)
    body = (await client.get(f"{PRODUCTS_URL}/{product['slug']}")).json()
    assert body["is_bestseller"] is False
    # The override survives so re-ticking the flag restores the custom wording.
    assert body["bestseller_label_override"] == "HOT SELLER"


async def test_overrides_are_null_on_a_product_that_never_set_one(
    client: AsyncClient, admin_token: str
):
    """Products created before this feature existed have no override, and must
    keep rendering from the category config alone."""
    cat = await _seed_category(client, admin_token, "Legacy Plants")
    from app.db.models import Product

    async with test_session_factory() as db:
        legacy = Product(
            name="Legacy",
            slug="legacy",
            price=100.0,
            category_id=cat["id"],
            is_bestseller=True,
            is_active=True,
        )
        db.add(legacy)
        await db.commit()
        await db.refresh(legacy)
        legacy_id = legacy.id
        legacy_slug = legacy.slug

    body = (await client.get(f"{PRODUCTS_URL}/{legacy_slug}")).json()
    assert body["bestseller_label_override"] is None
    assert body["bestseller_color_override"] is None
    assert body["id"] == legacy_id
