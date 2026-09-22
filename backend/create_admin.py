"""Add (or promote) an admin user — for running with MORE than one admin.

This script is NON-DESTRUCTIVE. It does NOT wipe anything and does NOT touch
orders, categories, products or users other than the one admin you give it:

  - If the email does not exist yet: a brand-new admin user is created.
  - If the email already exists: the existing account is promoted to admin
    (is_admin=True). If you also supply a password, it is updated too.
  - Existing admin flags on other users are never touched.

HOW TO USE PROPERLY INSIDE A SERVER (using uv)
-----------------------------------------------
Run it from the `backend/` directory with the project env set up by uv. The
script reads `DATABASE_URL` from the environment (or app settings / .env).

    cd /path/to/app/backend
    uv sync                          # first run only
    uv run python create_admin.py    # interactive — asks email + password

    # Non-interactive (useful over SSH / CI):
    uv run python create_admin.py --email boss@example.com --name "Boss"
    ADMIN_EMAIL=boss@example.com ADMIN_PASSWORD='s3cure-pass' uv run python create_admin.py --no-prompt

Afterwards, restart the backend so the change is live:

    uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

Flags:
    --email EMAIL      Admin email. Prompts if not given.
    --password PW      New/updated password (hidden prompt by default).
    --name NAME        Full name shown in the admin panel (default "Admin").
    --no-prompt        Never prompt; read ADMIN_EMAIL / ADMIN_PASSWORD from env.
"""

import asyncio
import os
import re
import sys
from getpass import getpass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.db.models import User

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _resolve_database_url() -> str | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        from app.core.config import settings

        url = settings.DATABASE_URL
    if not url:
        return None
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _ask_email() -> str:
    while True:
        email = input("Admin email: ").strip().lower()
        if not email:
            print("  Email cannot be empty.")
            continue
        if not EMAIL_RE.match(email):
            print("  That does not look like a valid email.")
            continue
        return email


def _ask_password() -> str:
    while True:
        pw = getpass("Password: ")
        if len(pw) < 8:
            print("  Password must be at least 8 characters.")
            continue
        confirm = getpass("Confirm password: ")
        if pw != confirm:
            print("  Passwords do not match. Try again.")
            continue
        return pw


def _ask_name() -> str:
    name = input("Full name (default: Admin): ").strip()
    return name or "Admin"


async def add_or_promote_admin(email: str, password: str | None, full_name: str) -> None:
    url = _resolve_database_url()
    if not url:
        print("DATABASE_URL is not set. Cannot connect to the database.")
        sys.exit(1)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=email,
                hashed_password=hash_password(password) if password else None,
                full_name=full_name,
                is_active=True,
                is_admin=True,
            )
            db.add(user)
            action = "created"
            created_new = True
        else:
            user.is_admin = True
            user.full_name = full_name or user.full_name
            if password:
                user.hashed_password = hash_password(password)
            action = "promoted"
            created_new = False

        await db.commit()
        await db.refresh(user)

    await engine.dispose()

    print()
    print(f"Admin {action}: {user.email} (id={user.id}, is_admin={user.is_admin}, active={user.is_active})")
    if created_new:
        print("  They can log in to the admin panel with the credentials you set.")
    else:
        print("  Existing account left intact — only admin flag/name/password updated as given.")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Add a new admin user or promote an existing user to admin. Non-destructive."
    )
    parser.add_argument("--email", help="Admin email (prompts if omitted).")
    parser.add_argument("--password", help="New/updated password (hidden prompt if omitted).")
    parser.add_argument("--name", help="Full name (defaults to 'Admin').")
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="Never prompt; read ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from the environment.",
    )
    args = parser.parse_args()

    if args.email:
        email = args.email.strip().lower()
        if not EMAIL_RE.match(email):
            print(f"Invalid email: {email}")
            sys.exit(1)
    elif args.no_prompt:
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        if not email:
            print("ADMIN_EMAIL is required with --no-prompt.")
            sys.exit(1)
    else:
        email = _ask_email()

    if args.password:
        password = args.password
    elif args.no_prompt:
        password = os.environ.get("ADMIN_PASSWORD") or None
        if not password:
            print("ADMIN_PASSWORD is required with --no-prompt.")
            sys.exit(1)
    else:
        password = _ask_password()

    if args.name:
        full_name = args.name
    elif args.no_prompt:
        full_name = os.environ.get("ADMIN_NAME") or "Admin"
    else:
        full_name = _ask_name()

    asyncio.run(add_or_promote_admin(email, password, full_name))


if __name__ == "__main__":
    main()
