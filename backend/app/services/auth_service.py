import secrets
from urllib.parse import urlencode

import httpx
from jose import JWTError
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.models import User
from app.schemas.auth import TokenResponse
from app.utils import redis as redis_mod

REFRESH_KEY_PREFIX = "refresh:"
RATE_LIMIT_PREFIX = "ratelimit:login:"
OAUTH_STATE_PREFIX = "oauth_state:"

RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 60  # seconds

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


# ---------------------------------------------------------------------------
# Token pair helpers
# ---------------------------------------------------------------------------

async def _store_refresh_token(user_id: int, token: str) -> None:
    if not redis_mod.redis_client:
        return
    key = f"{REFRESH_KEY_PREFIX}{user_id}"
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await redis_mod.redis_client.set(key, hash_token(token), ex=ttl)


async def _verify_refresh_token(user_id: int, token: str) -> bool:
    if not redis_mod.redis_client:
        return False
    key = f"{REFRESH_KEY_PREFIX}{user_id}"
    stored = await redis_mod.redis_client.get(key)
    if stored is None:
        return False
    return stored == hash_token(token)


async def _delete_refresh_token(user_id: int) -> None:
    if not redis_mod.redis_client:
        return
    await redis_mod.redis_client.delete(f"{REFRESH_KEY_PREFIX}{user_id}")


async def issue_tokens(user: User) -> TokenResponse:
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    await _store_refresh_token(user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Rate limiting (Redis INCR + EXPIRE)
# ---------------------------------------------------------------------------

async def check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed, False if rate limited."""
    if not redis_mod.redis_client:
        return True
    key = f"{RATE_LIMIT_PREFIX}{ip}"
    current = await redis_mod.redis_client.incr(key)
    if current == 1:
        await redis_mod.redis_client.expire(key, RATE_LIMIT_WINDOW)
    return current <= RATE_LIMIT_MAX


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

async def register_user(db: AsyncSession, email: str, password: str, full_name: str, phone: str | None) -> User:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        phone=phone,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    logger.info("User registered: id={} email={}", user.id, user.email)
    return user


async def guest_register_or_login(
    db: AsyncSession, email: str, full_name: str, phone: str | None
) -> User:
    existing = await db.execute(select(User).where(func.lower(User.email) == func.lower(email)))
    user = existing.scalar_one_or_none()
    if user:
        updated = False
        if not user.phone and phone:
            user.phone = phone
            updated = True
        if (not user.full_name or user.full_name == email.split('@')[0]) and full_name:
            user.full_name = full_name
            updated = True
        if updated:
            await db.flush()
        logger.info("Guest login for existing user: id={} email={}", user.id, user.email)
        return user

    user = User(
        email=email,
        hashed_password=None,
        full_name=full_name,
        phone=phone,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    logger.info("Guest user created: id={} email={}", user.id, user.email)
    return user



# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        logger.warning("Login failed – unknown email: {}", email)
        return None
    valid, updated_hash = verify_password(password, user.hashed_password)
    if not valid:
        logger.warning("Login failed – bad password for email: {}", email)
        return None
    if updated_hash:
        user.hashed_password = updated_hash
        await db.flush()
        logger.info("Rehashed password to Argon2 for user_id={}", user.id)
    logger.info("Login success: id={} email={}", user.id, user.email)
    return user


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

async def refresh_tokens(token: str) -> TokenResponse:
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise ValueError("Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")

    user_id = int(payload["sub"])
    if not await _verify_refresh_token(user_id, token):
        raise ValueError("Refresh token revoked or expired")

    # Rotate: delete old, issue new pair
    await _delete_refresh_token(user_id)

    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    await _store_refresh_token(user_id, refresh)
    logger.info("Token refreshed for user_id={}", user_id)
    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

async def logout(token: str) -> None:
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return
    await _delete_refresh_token(user_id)
    logger.info("User logged out: user_id={}", user_id)


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

async def generate_google_auth_url() -> str:
    state = secrets.token_urlsafe(32)
    if redis_mod.redis_client:
        await redis_mod.redis_client.set(f"{OAUTH_STATE_PREFIX}{state}", "1", ex=600)

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def validate_oauth_state(state: str) -> bool:
    if not redis_mod.redis_client:
        return False
    key = f"{OAUTH_STATE_PREFIX}{state}"
    val = await redis_mod.redis_client.get(key)
    if val is None:
        return False
    await redis_mod.redis_client.delete(key)
    return True


async def google_callback(db: AsyncSession, code: str, state: str) -> User:
    if not await validate_oauth_state(state):
        raise ValueError("Invalid or expired OAuth state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo_resp.raise_for_status()
        profile = userinfo_resp.json()

    google_id = profile["id"]
    email = profile["email"]
    full_name = profile.get("name", email.split("@")[0])

    # Try to find by google_id first, then by email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
        else:
            user = User(
                email=email,
                full_name=full_name,
                google_id=google_id,
                is_active=True,
            )
            db.add(user)

    await db.flush()
    await db.refresh(user)
    logger.info("Google OAuth login: id={} email={}", user.id, user.email)
    return user
