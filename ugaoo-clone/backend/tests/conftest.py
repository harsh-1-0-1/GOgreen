import fnmatch
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db

TEST_DB_URL = "sqlite+aiosqlite:///file:testdb?mode=memory&cache=shared&uri=true"

engine = create_async_engine(TEST_DB_URL, echo=False)
test_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def _reset_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


class FakeRedis:
    """Minimal in-memory Redis stand-in for tests."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._store[key] = value

    async def delete(self, *keys: str) -> None:
        for k in keys:
            self._store.pop(k, None)

    async def incr(self, key: str) -> int:
        val = int(self._store.get(key, "0")) + 1
        self._store[key] = str(val)
        return val

    async def expire(self, key: str, seconds: int) -> None:
        pass

    async def scan(self, cursor: int = 0, match: str = "*", count: int = 100) -> tuple[int, list[str]]:
        matched = [k for k in self._store if fnmatch.fnmatch(k, match)]
        return 0, matched

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        self._store.clear()


@pytest.fixture(autouse=True)
def _patch_redis(monkeypatch):
    import app.utils.redis as redis_mod
    import app.services.auth_service as auth_mod
    import app.services.category_service as cat_mod
    import app.services.product_service as prod_mod

    fake = FakeRedis()
    monkeypatch.setattr(redis_mod, "redis_client", fake)
    monkeypatch.setattr(auth_mod, "redis_client", fake)
    if hasattr(cat_mod, "redis_client"):
        monkeypatch.setattr(cat_mod, "redis_client", fake)
    if hasattr(prod_mod, "redis_client"):
        monkeypatch.setattr(prod_mod, "redis_client", fake)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    from main import app

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers for seeding test data & getting admin tokens
# ---------------------------------------------------------------------------

ADMIN_USER = {
    "email": "admin@test.com",
    "password": "Admin1234!",
    "full_name": "Admin User",
}


async def _register_and_make_admin(client: AsyncClient) -> str:
    """Register a user, promote to admin directly in DB, login and return token."""
    await client.post("/api/v1/auth/register", json=ADMIN_USER)
    # Promote to admin via raw DB
    async with test_session_factory() as db:
        from sqlalchemy import update
        from app.db.models import User
        await db.execute(update(User).where(User.email == ADMIN_USER["email"]).values(is_admin=True))
        await db.commit()
    resp = await client.post("/api/v1/auth/login", json={"email": ADMIN_USER["email"], "password": ADMIN_USER["password"]})
    return resp.json()["access_token"]


@pytest.fixture
async def admin_token(client: AsyncClient) -> str:
    return await _register_and_make_admin(client)


async def _seed_category(client: AsyncClient, admin_token: str, name: str, parent_id: int | None = None) -> dict:
    body = {"name": name}
    if parent_id:
        body["parent_id"] = parent_id
    resp = await client.post(
        "/api/v1/categories",
        json=body,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _seed_product_via_db(db_session, **kwargs) -> None:
    from app.db.models import Product
    product = Product(**kwargs)
    db_session.add(product)
    await db_session.flush()
    await db_session.refresh(product)
    return product


REGULAR_USER = {
    "email": "user@test.com",
    "password": "User1234!",
    "full_name": "Test User",
}


async def _register_user(client: AsyncClient) -> str:
    """Register a regular user and return access token."""
    await client.post("/api/v1/auth/register", json=REGULAR_USER)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": REGULAR_USER["email"], "password": REGULAR_USER["password"]},
    )
    return resp.json()["access_token"]


@pytest.fixture
async def user_token(client: AsyncClient) -> str:
    return await _register_user(client)


async def _seed_address(client: AsyncClient, token: str) -> dict:
    resp = await client.post(
        "/api/v1/addresses",
        json={
            "full_name": "Test User",
            "phone": "9876543210",
            "line1": "123 Green Lane",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "is_default": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _seed_product_and_category(client: AsyncClient, admin_token: str, stock: int = 10) -> dict:
    """Create a category + product and return the product dict."""
    cat = await _seed_category(client, admin_token, "Test Plants")
    from app.db.models import Product
    async with test_session_factory() as db:
        p = Product(
            name="Money Plant", slug="money-plant", description="A green friend",
            price=299.0, original_price=399.0, stock_qty=stock,
            category_id=cat["id"], images=["https://placehold.co/300"],
            tags=["indoor"], is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "name": p.name, "slug": p.slug, "price": p.price, "stock_qty": p.stock_qty}
