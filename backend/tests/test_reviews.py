from httpx import AsyncClient

from tests.conftest import _seed_product_and_category


async def test_guest_can_create_product_review(client: AsyncClient, admin_token: str):
    product = await _seed_product_and_category(client, admin_token)

    resp = await client.post(
        f"/api/v1/products/{product['id']}/reviews",
        json={
            "rating": 5,
            "title": "Healthy plant",
            "body": "Arrived fresh and well packed.",
        },
    )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user_id"] is None
    assert data["author_name"] == "Guest customer"
    assert data["rating"] == 5

    list_resp = await client.get(f"/api/v1/products/{product['id']}/reviews")
    assert list_resp.status_code == 200, list_resp.text
    listed = list_resp.json()
    assert listed["summary"]["review_count"] == 1
    assert listed["items"][0]["author_name"] == "Guest customer"
