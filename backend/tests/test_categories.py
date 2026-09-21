import pytest
from httpx import AsyncClient

from tests.conftest import _seed_category, _seed_product_via_db, test_session_factory

CAT_URL = "/api/v1/categories"


@pytest.mark.asyncio
async def test_list_categories_empty(client: AsyncClient):
    resp = await client.get(CAT_URL)
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "public, max-age=300, stale-while-revalidate=60"
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_category_admin_only(client: AsyncClient):
    resp = await client.post(CAT_URL, json={"name": "Plants"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_and_list_tree(client: AsyncClient, admin_token: str):
    parent = await _seed_category(client, admin_token, "Plants")
    assert parent["slug"] == "plants"

    child = await _seed_category(client, admin_token, "Indoor Plants", parent_id=parent["id"])
    assert child["parent_id"] == parent["id"]

    resp = await client.get(CAT_URL)
    tree = resp.json()
    assert len(tree) == 1
    assert tree[0]["slug"] == "plants"
    assert len(tree[0]["children"]) == 1
    assert tree[0]["children"][0]["slug"] == "indoor-plants"


@pytest.mark.asyncio
async def test_get_category_by_slug(client: AsyncClient, admin_token: str):
    await _seed_category(client, admin_token, "Seeds")
    resp = await client.get(f"{CAT_URL}/seeds")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Seeds"


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Old Name")
    resp = await client.put(
        f"{CAT_URL}/{cat['id']}",
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["slug"] == "new-name"


@pytest.mark.asyncio
async def test_delete_category(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "ToDelete")
    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_category_with_active_product_rejected(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "HasActive")
    async with test_session_factory() as db:
        await _seed_product_via_db(
            db,
            name="Active Plant",
            slug="active-plant",
            description="x",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=cat["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=True,
        )
        await db.commit()
    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    assert "active products" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_category_clears_soft_deleted_products(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "HasSoftDeleted")
    async with test_session_factory() as db:
        await _seed_product_via_db(
            db,
            name="Gone Plant",
            slug="gone-plant",
            description="x",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=cat["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=False,
        )
        await db.commit()
    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_parent_category_with_children_rejected(client: AsyncClient, admin_token: str):
    parent = await _seed_category(client, admin_token, "ParentCat")
    await _seed_category(client, admin_token, "ChildCat", parent_id=parent["id"])
    resp = await client.delete(
        f"{CAT_URL}/{parent['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    assert "subcategories" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_list_uses_cache_on_second_call(client: AsyncClient, admin_token: str):
    await _seed_category(client, admin_token, "Cached")
    r1 = await client.get(CAT_URL)
    r2 = await client.get(CAT_URL)
    assert r1.json() == r2.json()


@pytest.mark.asyncio
async def test_create_category_with_mobile_image_url(client: AsyncClient, admin_token: str):
    resp = await client.post(
        CAT_URL,
        json={"name": "Gifts", "mobile_image_url": "plantoga/categories/1/gift.png"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["mobile_image_url"] is not None
    assert "plantoga/categories/1/gift.png" in resp.json()["mobile_image_url"]


@pytest.mark.asyncio
async def test_update_category_mobile_image_url(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Decor")
    resp = await client.put(
        f"{CAT_URL}/{cat['id']}",
        json={"mobile_image_url": "https://example.com/circle.png"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["mobile_image_url"] == "https://example.com/circle.png"

    # clear it
    resp = await client.put(
        f"{CAT_URL}/{cat['id']}",
        json={"mobile_image_url": None},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["mobile_image_url"] is None


@pytest.mark.asyncio
async def test_tree_exposes_mobile_image_url(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Bonsai")
    await client.put(
        f"{CAT_URL}/{cat['id']}",
        json={"mobile_image_url": "plantoga/categories/2/bonsai.png"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    resp = await client.get(CAT_URL)
    tree = resp.json()
    node = tree[0]
    assert node["mobile_image_url"] is not None
    assert "bonsai" in node["mobile_image_url"]


@pytest.mark.asyncio
async def test_upload_category_mobile_image_requires_admin(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Garden")
    # Without auth - should be rejected
    resp = await client.post(f"{CAT_URL}/{cat['id']}/mobile-image")
    assert resp.status_code == 401
    # With auth but no file - FastAPI returns 422
    resp = await client.post(
        f"{CAT_URL}/{cat['id']}/mobile-image",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_category_blocked_when_product_has_order_history(client: AsyncClient, admin_token: str):
    from app.db.models import Order, OrderItem, User, Address

    cat = await _seed_category(client, admin_token, "OrderCat")
    async with test_session_factory() as db:
        product = await _seed_product_via_db(
            db,
            name="Order Plant",
            slug="order-plant",
            description="x",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=cat["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=False,
        )
        # Create user, address, order, order item
        user = User(email="t1@test.com", full_name="T1")
        db.add(user)
        await db.flush()

        address = Address(user_id=user.id, full_name="x", phone="x", line1="x", city="x", state="x", pincode="x")
        db.add(address)
        await db.flush()

        order = Order(user_id=user.id, total_amount=100, address_id=address.id)
        db.add(order)
        await db.flush()

        order_item = OrderItem(order_id=order.id, product_id=product.id, quantity=1, unit_price=100)
        db.add(order_item)
        await db.commit()

    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 409
    assert "past orders" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_category_clears_cart_items_and_reviews(client: AsyncClient, admin_token: str):
    from app.db.models import Cart, CartItem, ProductReview, ReviewStatus, User, Story, DoNotForgetProduct, Product

    cat = await _seed_category(client, admin_token, "ClearCat")
    async with test_session_factory() as db:
        product = await _seed_product_via_db(
            db,
            name="Clear Plant",
            slug="clear-plant",
            description="x",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=cat["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=False,
        )

        user = User(email="t2@test.com", full_name="T2")
        db.add(user)
        await db.flush()

        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.flush()

        cart_item = CartItem(cart_id=cart.id, product_id=product.id, quantity=1)
        db.add(cart_item)

        review = ProductReview(product_id=product.id, user_id=user.id, rating=5, status=ReviewStatus.PUBLISHED)
        db.add(review)

        story = Story(video="v.mp4", linked_product_id=product.id)
        db.add(story)

        dnf = DoNotForgetProduct(product_id=product.id)
        db.add(dnf)

        await db.commit()

        story_id = story.id

    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204

    # Verify records are gone or updated
    async with test_session_factory() as db:
        from sqlalchemy import select

        # product should be gone
        prod = await db.execute(select(Product).where(Product.id == product.id))
        assert prod.scalar_one_or_none() is None

        # cart item should be gone
        ci = await db.execute(select(CartItem).where(CartItem.product_id == product.id))
        assert ci.scalar_one_or_none() is None

        # review should be gone
        pr = await db.execute(select(ProductReview).where(ProductReview.product_id == product.id))
        assert pr.scalar_one_or_none() is None

        # DNF should be gone
        dnf_chk = await db.execute(select(DoNotForgetProduct).where(DoNotForgetProduct.product_id == product.id))
        assert dnf_chk.scalar_one_or_none() is None

        # story should have linked_product_id = None
        s = await db.execute(select(Story).where(Story.id == story_id))
        assert s.scalar_one().linked_product_id is None
