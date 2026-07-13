# Plantoga — Your Independent Solution for Gardening & Farming

A full-stack e-commerce platform for plants, seeds, pots, and gardening essentials. Built from scratch with **FastAPI** (backend) and **React + Vite** (frontend).

Plantoga is designed to be the one-stop shop for everything green — from indoor air-purifying plants to organic fertilisers and kitchen-garden seeds.

## Prerequisites

- **Python 3.12+** with [`uv`](https://docs.astral.sh/uv/) installed
- **Node.js 18+** with npm
- **Redis** running on `localhost:6379` (or set `REDIS_URL`)
- (Optional) **Cloudinary** account for image uploads
- (Optional) **Google OAuth** credentials for social login
- (Optional) **Razorpay** test credentials for payments

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/harsh-1-0-1/Plantoga.git
cd Plantoga

# 2. Set up environment
cp .env.example backend/.env
# Edit backend/.env — at minimum set SECRET_KEY

# 3. Install backend dependencies
make install

# 4. Run database migration
make migrate

# 5. Seed sample data (10 categories, 50 products)
make seed

# 6. Start the backend (http://localhost:8000)
make dev

# In another terminal:

# 7. Install frontend dependencies
make frontend-install

# 8. Start the frontend (http://localhost:5173)
make frontend-dev
```

## Docker Compose Deployment

The compose stack builds and runs the API, React website, Postgres, and Redis:

```bash
cp .env.example .env
# Edit .env and set at least SECRET_KEY and POSTGRES_PASSWORD.
docker compose up --build -d
```

By default the website is served at `http://localhost`, the API is also exposed at
`http://localhost:8000`, and Nginx proxies browser requests from `/api` and
`/static` to the backend container. To seed sample data after the stack is healthy:

```bash
docker compose --profile seed run --rm seed
```

## Creating Your First Admin User

```bash
cd backend

# Register a user via the API or the frontend, then promote to admin:
uv run python -c "
import asyncio
from sqlalchemy import update
from app.db.session import async_session_factory
from app.db.models import User

async def promote(email: str):
    async with async_session_factory() as db:
        await db.execute(update(User).where(User.email == email).values(is_admin=True))
        await db.commit()
        print(f'Done — {email} is now an admin')

asyncio.run(promote('your-email@example.com'))
"
```

Then visit `http://localhost:5173/admin` to access the admin dashboard.

## Available Make Commands

| Command | Description |
|---|---|
| `make install` | Install backend Python dependencies |
| `make dev` | Start FastAPI dev server (port 8000) |
| `make test` | Run all backend pytest tests |
| `make seed` | Seed database with sample categories & products |
| `make migrate` | Run Alembic migrations |
| `make lint` | Lint Python code with ruff |
| `make format` | Format Python code with ruff |
| `make frontend-install` | Install frontend npm dependencies |
| `make frontend-dev` | Start Vite dev server (port 5173) |
| `make frontend-build` | Build frontend for production |

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Architecture

```
Plantoga/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers (auth, products, cart, orders, admin, ...)
│   │   ├── core/            # Config, security, logging
│   │   ├── db/              # SQLAlchemy models, session, base
│   │   ├── schemas/         # Pydantic v2 request/response schemas
│   │   ├── services/        # Business logic layer
│   │   └── utils/           # Redis helpers, Cloudinary helper
│   ├── alembic/             # Database migrations
│   ├── tests/               # Pytest test suite
│   ├── main.py              # FastAPI app entry point
│   └── seed.py              # Database seeder
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components (layout, auth, cart, admin, ui)
│   │   ├── hooks/           # React Query hooks
│   │   ├── lib/             # Axios, React Query client
│   │   ├── pages/           # Route pages (storefront + admin dashboard)
│   │   ├── store/           # Zustand stores (auth, cart)
│   │   └── types/           # TypeScript type definitions
│   └── ...
├── .env.example
├── Makefile
└── docker-compose.yml
```

## Tech Stack

**Backend**: FastAPI, SQLAlchemy (async), SQLite (aiosqlite), Alembic, Redis, Pydantic v2, JWT (python-jose), Argon2 (pwdlib), Cloudinary, slowapi

**Frontend**: React 18, TypeScript, Vite, TailwindCSS 4, React Router v6, Zustand, TanStack React Query, Axios, react-hook-form + zod, Lucide Icons

## License

MIT
