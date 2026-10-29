import pytest
from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"

SAMPLE_USER = {
    "email": "test@example.com",
    "password": "Str0ngP@ss!",
    "full_name": "Test User",
}


# ---- Register ----------------------------------------------------------

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post(REGISTER_URL, json=SAMPLE_USER)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {**SAMPLE_USER, "email": "dupe@example.com"}
    resp1 = await client.post(REGISTER_URL, json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post(REGISTER_URL, json=payload)
    assert resp2.status_code == 409
    assert "already registered" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    payload = {**SAMPLE_USER, "email": "short@example.com", "password": "abc"}
    resp = await client.post(REGISTER_URL, json=payload)
    assert resp.status_code == 422


# ---- Login -------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    reg_email = "login_ok@example.com"
    await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})

    resp = await client.post(LOGIN_URL, json={"email": reg_email, "password": SAMPLE_USER["password"]})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    reg_email = "wrongpw@example.com"
    await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})

    resp = await client.post(LOGIN_URL, json={"email": reg_email, "password": "WrongPassword!"})
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post(LOGIN_URL, json={"email": "nobody@example.com", "password": "whatever"})
    assert resp.status_code == 401


# ---- Token refresh ------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_success(client: AsyncClient):
    reg_email = "refresh@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    refresh_token = reg_resp.json()["refresh_token"]

    resp = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["refresh_token"] != refresh_token  # rotated


@pytest.mark.asyncio
async def test_refresh_reuse_old_token(client: AsyncClient):
    reg_email = "reuse_rt@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    old_refresh = reg_resp.json()["refresh_token"]

    # Rotate once
    await client.post(REFRESH_URL, json={"refresh_token": old_refresh})

    # Old token should now be invalid
    resp = await client.post(REFRESH_URL, json={"refresh_token": old_refresh})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post(REFRESH_URL, json={"refresh_token": "garbage.token.value"})
    assert resp.status_code == 401


# ---- Logout -------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout_flow(client: AsyncClient):
    reg_email = "logout@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    refresh_token = reg_resp.json()["refresh_token"]

    resp = await client.post(LOGOUT_URL, json={"refresh_token": refresh_token})
    assert resp.status_code == 204

    # Refresh should now fail
    resp2 = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})
    assert resp2.status_code == 401


# ---- Protected endpoint --------------------------------------------------

@pytest.mark.asyncio
async def test_access_token_works(client: AsyncClient):
    reg_email = "access@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    access_token = reg_resp.json()["access_token"]

    resp = await client.get(
        "/api/v1/health",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200


# ---- Change password ----------------------------------------------------

CHANGE_PW_URL = "/api/v1/auth/change-password"


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient):
    reg_email = "changepw@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    tokens = reg_resp.json()

    resp = await client.post(
        CHANGE_PW_URL,
        json={"current_password": SAMPLE_USER["password"], "new_password": "N3wStr0ngPass!"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    # Old password no longer works, new one does
    old = await client.post(LOGIN_URL, json={"email": reg_email, "password": SAMPLE_USER["password"]})
    assert old.status_code == 401
    new = await client.post(LOGIN_URL, json={"email": reg_email, "password": "N3wStr0ngPass!"})
    assert new.status_code == 200

    # The refresh token from before the change was revoked
    stale = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})
    assert stale.status_code == 401


@pytest.mark.asyncio
async def test_change_password_wrong_current(client: AsyncClient):
    reg_email = "changepw_wrong@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    access_token = reg_resp.json()["access_token"]

    resp = await client.post(
        CHANGE_PW_URL,
        json={"current_password": "NotMyPassword", "new_password": "N3wStr0ngPass!"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_too_short(client: AsyncClient):
    reg_email = "changepw_short@example.com"
    reg_resp = await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})
    access_token = reg_resp.json()["access_token"]

    resp = await client.post(
        CHANGE_PW_URL,
        json={"current_password": SAMPLE_USER["password"], "new_password": "abc"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_change_password_requires_auth(client: AsyncClient):
    resp = await client.post(
        CHANGE_PW_URL,
        json={"current_password": "whatever1", "new_password": "N3wStr0ngPass!"},
    )
    assert resp.status_code == 401


# ---- Guest login --------------------------------------------------------

GUEST_URL = "/api/v1/auth/guest"


@pytest.mark.asyncio
async def test_guest_login_refused_for_registered_email(client: AsyncClient):
    reg_email = "guest_victim@example.com"
    await client.post(REGISTER_URL, json={**SAMPLE_USER, "email": reg_email})

    resp = await client.post(GUEST_URL, json={"email": reg_email, "full_name": "Attacker"})
    assert resp.status_code == 409
    assert "sign in" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_guest_login_refused_for_registered_phone(client: AsyncClient):
    await client.post(
        REGISTER_URL, json={**SAMPLE_USER, "email": "guest_phone_victim@example.com", "phone": "9876543210"},
    )

    resp = await client.post(GUEST_URL, json={"email": "9876543210", "full_name": "Attacker"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_guest_login_reuses_guest_account(client: AsyncClient):
    payload = {"email": "repeat_guest@example.com", "full_name": "Repeat Guest"}
    first = await client.post(GUEST_URL, json=payload)
    assert first.status_code == 200

    second = await client.post(GUEST_URL, json=payload)
    assert second.status_code == 200
