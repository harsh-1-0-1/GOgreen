"""Products can sit in several categories, and the catalog can be filtered by them.

A product keeps ONE primary category (`products.category_id`) plus any number of
additional ones (`product_categories`). These tests pin the two behaviours that are
easy to break: the storefront must find a product through an ADDITIONAL category
(not just its primary one), and the admin must be able to edit the extra set.
"""

import json

import pytest
from httpx import AsyncClient

from app.db.models import Product, product_categories
from tests.conftest import _seed_category, test_session_factory

PROD_URL = "/api/v1/products"
CAT_URL = "/api/v1/categories"


async def _create_product(
    client: AsyncClient, admin_token: str, name: str, category_id: int,
    extra_category_ids: list[int] | None = None,
    price: int = 499,
) -> dict:
    data: dict[str, str] = {
        "name": name,
        "price": str(price),
        "category_id": str(category_id),
    }
    if extra_category_ids is not None:
        data["additional_category_ids"] = json.dumps(extra_category_ids)
    resp = await client.post(
        PROD_URL, data=data, headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _seed_product(name: str, slug: str, category_id: int) -> dict:
    async with test_session_factory() as db:
        product = Product(
            name=name,
            slug=slug,
            description=f"{name} description",
            price=299.0,
            stock_qty=5,
            category_id=category_id,
            images=[],
            tags=[],
            is_active=True,
        )
        db.add(product)
        await db.commit()
        return {"id": product.id, "slug": slug}


async def _slugs_for(client: AsyncClient, **params) -> set[str]:
    resp = await client.get(PROD_URL, params=params)
    assert resp.status_code == 200, resp.text
    return {item["slug"] for item in resp.json()["items"]}


# ---- Assigning multiple categories ---------------------------------------


@pytest.mark.asyncio
async def test_create_product_with_additional_categories(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Succulents")
    extra = await _seed_category(client, admin_token, "Air Purifying")

    created = await _create_product(
        client, admin_token, "Aloe Vera", primary["id"], [extra["id"]]
    )

    assert created["category_id"] == primary["id"]
    assert created["additional_category_ids"] == [extra["id"]]
    assert created["category_ids"] == [primary["id"], extra["id"]]
    assert [c["slug"] for c in created["categories"]] == ["succulents", "air-purifying"]


@pytest.mark.asyncio
async def test_product_without_extra_categories_reports_only_primary(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Seeds")
    created = await _create_product(client, admin_token, "Basil Seeds", primary["id"])

    assert created["additional_category_ids"] == []
    assert created["category_ids"] == [primary["id"]]


@pytest.mark.asyncio
async def test_primary_is_not_duplicated_into_the_link_table(
    client: AsyncClient, admin_token: str,
):
    """The primary lives in `products.category_id`; storing it in the join table too
    would duplicate it in every rendered category list."""
    primary = await _seed_category(client, admin_token, "Pots")
    extra = await _seed_category(client, admin_token, "Planters")

    created = await _create_product(
        client, admin_token, "Terracotta Pot", primary["id"], [primary["id"], extra["id"]]
    )

    assert created["additional_category_ids"] == [extra["id"]]
    async with test_session_factory() as db:
        from sqlalchemy import func, select

        count = (
            await db.execute(
                select(func.count())
                .select_from(product_categories)
                .where(product_categories.c.product_id == created["id"])
            )
        ).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_create_product_rejects_unknown_additional_category(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Fertilizers")
    resp = await client.post(
        PROD_URL,
        data={
            "name": "Mystery Feed",
            "price": "199",
            "category_id": str(primary["id"]),
            "additional_category_ids": "[99999]",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "99999" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_product_rejects_non_integer_category_ids(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Tools")
    resp = await client.post(
        PROD_URL,
        data={
            "name": "Spade",
            "price": "249",
            "category_id": str(primary["id"]),
            "additional_category_ids": '["succulents"]',
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400


# ---- Filtering ----------------------------------------------------------


@pytest.mark.asyncio
async def test_filter_finds_product_through_its_additional_category(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Indoor Plants")
    extra = await _seed_category(client, admin_token, "Vastu Friendly")
    await _create_product(client, admin_token, "Tulsi", primary["id"], [extra["id"]])

    assert await _slugs_for(client, category_slug="vastu-friendly") == {"tulsi"}
    assert await _slugs_for(client, category_slug="indoor-plants") == {"tulsi"}


@pytest.mark.asyncio
async def test_filter_by_multiple_categories_returns_the_union(
    client: AsyncClient, admin_token: str,
):
    plants = await _seed_category(client, admin_token, "Plants")
    pots = await _seed_category(client, admin_token, "Pots")
    seeds = await _seed_category(client, admin_token, "Seeds")

    await _create_product(client, admin_token, "Money Plant", plants["id"])
    await _create_product(client, admin_token, "Clay Pot", pots["id"], [plants["id"]])
    await _create_product(client, admin_token, "Sunflower Seeds", seeds["id"])

    found = await _slugs_for(client, categories="pots,seeds")
    assert found == {"clay-pot", "sunflower-seeds"}

    # The single-slug param and the multi-slug param combine, so a nav link
    # (?category=plants) keeps working next to a sidebar multi-select.
    combined = await _slugs_for(client, category_slug="seeds", categories="pots")
    assert combined == {"clay-pot", "sunflower-seeds"}


@pytest.mark.asyncio
async def test_parent_category_filter_includes_products_linked_to_a_child(
    client: AsyncClient, admin_token: str,
):
    parent = await _seed_category(client, admin_token, "Cacti Succulents")
    child = await _seed_category(client, admin_token, "Aloe Vera", parent_id=parent["id"])
    other = await _seed_category(client, admin_token, "Ceramic Planters")

    # Primary is the child; additionally listed under a completely different parent.
    await _create_product(client, admin_token, "Glow Desk Pot", child["id"], [other["id"]])

    assert await _slugs_for(client, category_slug="cacti-succulents") == {"glow-desk-pot"}


@pytest.mark.asyncio
async def test_filter_ignores_unknown_and_blank_category_slugs(
    client: AsyncClient, admin_token: str,
):
    plants = await _seed_category(client, admin_token, "Plants")
    await _create_product(client, admin_token, "Basil", plants["id"])

    assert await _slugs_for(client, category_slug="deleted-category") == set()
    assert await _slugs_for(client, categories=" , plants , ") == {"basil"}


@pytest.mark.asyncio
async def test_combining_categories_with_other_filters_still_applies(
    client: AsyncClient, admin_token: str,
):
    plants = await _seed_category(client, admin_token, "Plants")
    pots = await _seed_category(client, admin_token, "Pots")
    await _create_product(client, admin_token, "Cheap Plant", plants["id"], price=90)
    await _create_product(client, admin_token, "Pricey Pot", pots["id"], price=999)

    found = await _slugs_for(client, categories="plants,pots", max_price=100)
    assert found == {"cheap-plant"}


# ---- Editing ------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_replaces_the_additional_category_set(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Plants")
    first = await _seed_category(client, admin_token, "Flowering")
    second = await _seed_category(client, admin_token, "Fragrant")
    created = await _create_product(
        client, admin_token, "Jasmine", primary["id"], [first["id"]]
    )

    resp = await client.put(
        f"{PROD_URL}/{created['id']}",
        json={"additional_category_ids": [second["id"]]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["additional_category_ids"] == [second["id"]]
    assert body["category_ids"] == [primary["id"], second["id"]]


@pytest.mark.asyncio
async def test_update_omitting_the_field_leaves_categories_alone(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Plants")
    extra = await _seed_category(client, admin_token, "Flowering")
    created = await _create_product(
        client, admin_token, "Hibiscus", primary["id"], [extra["id"]]
    )

    resp = await client.put(
        f"{PROD_URL}/{created['id']}",
        json={"price": 749},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["additional_category_ids"] == [extra["id"]]


@pytest.mark.asyncio
async def test_update_with_empty_list_clears_extra_categories(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Plants")
    extra = await _seed_category(client, admin_token, "Flowering")
    created = await _create_product(
        client, admin_token, "Bougainvillea", primary["id"], [extra["id"]]
    )

    resp = await client.put(
        f"{PROD_URL}/{created['id']}",
        json={"additional_category_ids": []},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["additional_category_ids"] == []
    assert await _slugs_for(client, category_slug="flowering") == set()


@pytest.mark.asyncio
async def test_promoting_a_category_to_primary_drops_it_from_the_extras(
    client: AsyncClient, admin_token: str,
):
    plants = await _seed_category(client, admin_token, "Plants")
    succulents = await _seed_category(client, admin_token, "Succulents")
    created = await _create_product(
        client, admin_token, "Haworthia", plants["id"], [succulents["id"]]
    )

    resp = await client.put(
        f"{PROD_URL}/{created['id']}",
        json={"category_id": succulents["id"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["category_id"] == succulents["id"]
    assert body["additional_category_ids"] == []
    assert body["category_ids"] == [succulents["id"]]


@pytest.mark.asyncio
async def test_admin_raw_payload_carries_every_category(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Plants")
    extra = await _seed_category(client, admin_token, "Air Purifying")
    created = await _create_product(
        client, admin_token, "Peace Lily", primary["id"], [extra["id"]]
    )

    resp = await client.get(
        f"{PROD_URL}/admin/{created['id']}/raw",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["additional_category_ids"] == [extra["id"]]
    assert body["category_ids"] == [primary["id"], extra["id"]]
    assert [c["slug"] for c in body["categories"]] == ["plants", "air-purifying"]


# ---- Category deletion ---------------------------------------------------


@pytest.mark.asyncio
async def test_deleting_a_category_unlinks_it_from_products_that_only_list_it(
    client: AsyncClient, admin_token: str,
):
    primary = await _seed_category(client, admin_token, "Plants")
    extra = await _seed_category(client, admin_token, "Bonsai")
    await _create_product(client, admin_token, "Ficus Bonsai", primary["id"], [extra["id"]])

    resp = await client.delete(
        f"{CAT_URL}/{extra['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 204, resp.text

    # The product survives, still listed under its primary category.
    detail = await client.get(f"{PROD_URL}/ficus-bonsai")
    assert detail.status_code == 200
    assert detail.json()["category_ids"] == [primary["id"]]
    assert await _slugs_for(client, category_slug="bonsai") == set()


@pytest.mark.asyncio
async def test_deleting_a_products_primary_category_still_removes_its_links(
    client: AsyncClient, admin_token: str,
):
    """Deleting a category hard-deletes the products it owns; their links in other
    categories must not be left dangling."""
    doomed = await _seed_category(client, admin_token, "Doomed Plants")
    survivor = await _seed_category(client, admin_token, "Survivors")
    created = await _create_product(
        client, admin_token, "Old Plant", doomed["id"], [survivor["id"]]
    )

    # Products with an active flag block the delete; deactivate first, as the admin UI does.
    async with test_session_factory() as db:
        product = await db.get(Product, created["id"])
        product.is_active = False
        await db.commit()

    resp = await client.delete(
        f"{CAT_URL}/{doomed['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 204, resp.text

    async with test_session_factory() as db:
        from sqlalchemy import select

        rows = (
            await db.execute(
                select(product_categories.c.product_id).where(
                    product_categories.c.category_id == survivor["id"]
                )
            )
        ).scalars().all()
    assert rows == []