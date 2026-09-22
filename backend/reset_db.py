"""Reset the database: wipe ALL data and create a single admin user.

HOW TO USE PROPERLY INSIDE A SERVER (using uv)
-----------------------------------------------
This script DESTROYS every row in the database it is pointed at — orders,
categories, products, users, carts, banners, settings, everything — and then
creates exactly one admin user with the email/password you enter.

Only run it when:

1. The `DATABASE_URL` environment variable points to the server database
   (the same one the app uses). The script reads it from the environment, or
   falls back to the `.env` / app settings.

2. You are on the server (or have `psql`/DB access), running from the
   `backend/` directory with the project's Python env already set up by uv.

WARNING: NEVER run this against a live production database unless you really
intend to delete all data. There is no undo. Back up first:

    pg_dump "$DATABASE_URL" > backup.sql

Standard workflow on the server:

    cd /path/to/app/backend          # where pyproject.toml lives
    uv sync                          # create/refresh the .venv (first run only)
    source .venv/bin/activate        # (uv run does this automatically)

    # Interactive (recommended) — it will ask for admin email + password:
    uv run python reset_db.py

    # Non-interactive — pass credentials as flags or env vars (useful over SSH):
    uv run python reset_db.py --email admin@example.com
    ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='s3cure-pass' uv run python reset_db.py --no-prompt

Afterwards, restart the backend so the new empty state is live:

    uv run alembic upgrade head      # ensure schema matches the app
    uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

Table of flags:
    --email EMAIL          Admin email. Prompts if not given.
    --password PW          Admin password (hidden prompt by default).
    --no-prompt            Never prompt; take values from flags or
                           ADMIN_EMAIL / ADMIN_PASSWORD env vars.
    --force                Skip the interactive "type CONFIRM_RESE" confirmation.
"""

import asyncio
import os
import re
import sys
from getpass import getpass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.db.models import (
    Address,
    Banner,
    BlogPost,
    Cart,
    CartItem,
    Category,
    CorporateInquiry,
    DamageClaim,
    DoNotForgetProduct,
    MenuItem,
    Order,
    OrderItem,
    Product,
    ProductReview,
    Refund,
    StoreSettings,
    Story,
    User,
    WebhookEvent,
)

# Every table, imported above, used both for the delete order (sqlite path)
# and for documenting what gets wiped.
ALL_TABLES = [
    DamageClaim,
    OrderItem,
    Refund,
    WebhookEvent,
    CartItem,
    Cart,
    Order,
    Address,
    ProductReview,
    DoNotForgetProduct,
    Story,
    BlogPost,
    Banner,
    Product,
    Category,
    CorporateInquiry,
    MenuItem,
    StoreSettings,
    User,
]

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
        pw = getpass("Admin password: ")
        if len(pw) < 8:
            print("  Password must be at least 8 characters.")
            continue
        confirm = getpass("Confirm password: ")
        if pw != confirm:
            print("  Passwords do not match. Try again.")
            continue
        return pw


def _confirm_wipe() -> None:
    print()
    print("This will DELETE ALL DATA in the database:")
    for model in ALL_TABLES:
        print(f"  - {model.__tablename__}")
    print()
    answer = input('Type "CONFIRM_RESE" to continue, anything else to abort: ')
    if answer.strip() != "CONFIRM_RESE":
        print("Aborted. No changes were made.")
        sys.exit(1)


async def reset_and_create_admin(email: str, password: str) -> None:
    url = _resolve_database_url()
    if not url:
        print("DATABASE_URL is not set. Cannot determine which database to reset.")
        sys.exit(1)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        dialect = conn.dialect.name
        if dialect == "postgresql":
            # TRUNCATE ... RESTART IDENTITY resets sequences so the new admin
            # gets id 1; CASCADE handles FK references automatically.
            await conn.execute(
                text(
                    "TRUNCATE "
                    + ", ".join(f'"{m.__tablename__}"' for m in ALL_TABLES)
                    + " RESTART IDENTITY CASCADE"
                )
            )
        else:
            # sqlite has no TRUNCATE; delete children before parents using
            # the FK-sorted table order.
            for model in ALL_TABLES:
                await conn.execute(text(f'DELETE FROM "{model.__tablename__}"'))

    async with session_factory() as db:
        admin = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

    await engine.dispose()

    print()
    print("Database reset complete.")
    print(f"  Admin user created: {admin.email} (id={admin.id}, is_admin=True)")
    print("  You can now log in at the admin panel with these credentials.")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Wipe the entire database and create one admin user."
    )
    parser.add_argument("--email", help="Admin email (prompts if omitted).")
    parser.add_argument("--password", help="Admin password (hidden prompt if omitted).")
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="Never prompt; read ADMIN_EMAIL / ADMIN_PASSWORD from the environment.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip the destructive confirmation question.",
    )
    args = parser.parse_args()

    if not args.force:
        _confirm_wipe()

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
        password = os.environ.get("ADMIN_PASSWORD", "")
        if not password:
            print("ADMIN_PASSWORD is required with --no-prompt.")
            sys.exit(1)
    else:
        password = _ask_password()

    asyncio.run(reset_and_create_admin(email, password))


if __name__ == "__main__":
    main()
