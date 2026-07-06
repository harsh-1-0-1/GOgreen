from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cdn import get_real_client_ip
from app.core.security import get_current_active_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    GuestRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.register_user(
            db, email=body.email, password=body.password, full_name=body.full_name, phone=body.phone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return await auth_service.issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = get_real_client_ip(request)
    if not await auth_service.check_rate_limit(client_ip):
        logger.warning("Rate limit exceeded for IP: {}", client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in a minute.",
        )

    user = await auth_service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return await auth_service.issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        return await auth_service.refresh_tokens(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc),
        ) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest):
    await auth_service.logout(body.refresh_token)


@router.get("/me")
async def get_me(user: User = Depends(get_current_active_user)):
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name,
        "phone": user.phone, "is_active": user.is_active, "is_admin": user.is_admin,
    }


@router.get("/google")
async def google_auth():
    url = await auth_service.generate_google_auth_url()
    return {"authorization_url": url}


@router.get("/google/callback", response_model=TokenResponse)
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.google_callback(db, code=code, state=state)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Google OAuth error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to authenticate with Google",
        ) from exc
    return await auth_service.issue_tokens(user)


@router.post("/guest", response_model=TokenResponse)
async def guest_login(body: GuestRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.guest_register_or_login(
        db, email=body.email, full_name=body.full_name, phone=body.phone
    )
    return await auth_service.issue_tokens(user)
