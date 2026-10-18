# AGENTS.md

Read this before making any changes. It saves you from re-discovering how the repo works.

## What this is

**Plantoga** — a full-stack e-commerce platform for plants/gardening supplies. Monorepo:

- `backend/` — Python 3.11+, **FastAPI**, SQLAlchemy 2 (async), Pydantic v2, Alembic, Redis cache, JWT auth, S3/CDN images, Razorpay payments. Package manager: **`uv`**.
- `frontend/` — React 19 + TypeScript, **Vite 8**, TailwindCSS 4, React Router v7, Zustand, TanStack Query v5, Axios. Package manager: **npm**.
- SQLite locally, Postgres 16 in Docker/prod. Default DB is relative-path SQLite (see gotchas).

API prefix: `/api/v1`. Admin routes: `/admin/*`. Frontend `@/` alias → `src/`.

## Fastest onboarding path

1. `README.md` (root) — accurate quick start + architecture.
2. `backend/main.py` — app entry, middleware, exception handlers, router mount.
3. `backend/app/api/v1/router.py` — all endpoints registered here.
4. `frontend/src/App.tsx` — all routes.
5. `backend/README_IMAGES.md` — image storage conventions.
6. `plan_docs/DEPLOYMENT.md` + `plan_docs/decisions/PERFORMANCE_DECISIONS.md` — deployment and intentional design choices (gitignored but present locally).
7. `.kiro/specs/` — recent spec docs for the variant/quick-add behavior.

## Layout

```
backend/
  main.py                 FastAPI entry (lifespan, middleware, /api/v1)
  pyproject.toml          deps + ruff + pytest config
  alembic.ini, alembic/   migrations (alembic/versions/, 40+)
  seed.py                 DB seeder (DESTRUCTIVE unless --only-catalog)
  start.sh                prod: wait-for-db, migrate, uvicorn
  app/
    api/v1/               22 thin route modules + router.py
    api/middleware.py     CloudFrontGateMiddleware
    core/                 config.py, security.py, rate_limit.py, logging.py, cdn.py, tasks.py
    db/
      models.py           ALL 30 models + enums in one file
      session.py, base.py
    schemas/              one Pydantic module per domain
    services/             business logic — routes call services, not ORM
    utils/                redis, image_upload, slugs, variant_pricing, cloudinary, local_storage
  tests/                  pytest suite (conftest.py + 25 test files) — no Redis needed
  static/                 local image storage in dev (gitignored)
  .env                    LOCAL SECRETS — never read or commit
frontend/
  src/
    App.tsx               route table
    pages/                storefront pages + pages/admin/ (16 admin pages)
    components/           grouped by domain: admin, auth, cart, layout, product, ui, ...
    hooks/                one React Query hook module per domain
    store/                Zustand: authStore.ts, cartStore.ts
    lib/
      api.ts              Axios instance + auth refresh interceptor
      queryClient.ts      staleTime 5min, retry 1, no refetch-on-focus
    types/index.ts        central TS types
  vite.config.js          AUTHORITATIVE (see gotchas)
  eslint.config.js        flat config, warnings mostly demoted
Makefile                  root commands (delegates to both projects)
docker-compose.yml        postgres, redis, backend, frontend, seed
```

## Commands

Run from repo root unless noted.

```bash
# Setup
cp .env.example backend/.env          # then set SECRET_KEY
make install                          # backend: uv sync --all-extras
make frontend-install                 # frontend: npm install

# Run
make migrate                          # alembic upgrade head
make seed                             # DANGER: wipes DB. Safe: make seed-catalog
make dev                              # backend → :8000 (uv run fastapi dev)
make frontend-dev                     # frontend → :5173

# Verify (run before finishing any task)
make test                             # backend pytest (in-memory SQLite + FakeRedis)
make lint                             # backend ruff check
make format                           # backend ruff format
cd frontend && npm run lint           # eslint
cd frontend && npm run build          # tsc -b && eslint && vite build

# Docker (full stack)
docker compose up --build -d          # site :80, API :8000
```

There is **no frontend test runner** — only backend has tests.

## Conventions

**Backend (layered, keep it that way):**
- Route handler (`app/api/v1/x.py`) → service (`app/services/x_service.py`) → model (`app/db/models.py`).
- Routes stay thin. Schema in `app/schemas/`, never inline dicts.
- `async def` everywhere, `AsyncSession`, `expire_on_commit=False`.
- Auth deps from `app/core/security.py`: `get_current_user`, `get_optional_user`, `require_admin`.
- `str | None` and `Annotated[...]` syntax. Line length 120 (ruff, `E501` ignored).
- Logging via `loguru` (`logger.info/warning/exception`), not stdlib logging.
- Caching: module-level `*_TTL` constants, `make_list_cache_key(...)`, explicit invalidation on writes.

**Frontend:**
- One hook per domain in `src/hooks/`, using React Query with explicit `queryKey` arrays.
- Zustand stores use selector-based subscriptions; cart does optimistic updates with rollback.
- Type-only imports must use `import type` (`verbatimModuleSyntax`).
- `no-explicit-any` and `no-unused-vars` are warnings only; `react-hooks/rules-of-hooks` is an error.

**Images:** stored as portable **relative keys** (`plantoga/{folder}/{id}/{uuid}.webp` + `.thumb/.card/.detail` variants), never absolute URLs in DB. See `backend/README_IMAGES.md`.

**Git:** conventional commits (`feat(scope):`, `fix(scope):`). Never commit `.env`, `plantoga.db`, `static/`, `logs/`.

## Gotchas (read before editing)

1. **DB path is CWD-relative.** `sqlite+aiosqlite:///./plantoga.db` resolves against where you run the command. Always run migrations/seed/tests from `backend/` (Makefile does this). A stray 0-byte `plantoga.db` at root is a trap.
2. **`make seed` / `python seed.py` wipes all tables.** Use `--only-catalog` / `make seed-catalog` for safe reseeding.
3. **Two Vite configs.** `vite.config.js` **and** `vite.config.ts` both exist; Vite resolves `.js` first, so **`vite.config.js` is the authoritative one**. Editing `.ts` does nothing.
4. **Two `.env` files.** Docker Compose reads root `.env`; FastAPI reads `backend/.env`. Root `.env.example` is the template for both.
5. **`CloudFrontGateMiddleware` 403s everything** if `REQUIRE_CLOUDFRONT=true` without a valid `CLOUDFRONT_SECRET`. Keep `false` locally.
6. **Variant/stock system is the hardest domain.** `variant_groups`, `price_map` (combo keys joined by `__`), `pot_price` grids, plus `StockMapMissingError`. Read `plan_docs/VARIANT_*.md` and `.kiro/specs/` before touching. "Combo" was renamed from "bundle" recently — both terms appear in history.
7. **CloudFront caches admin GETs** — list responses can be stale up to TTL after a mutation (no invalidation). Combined with `staleTime` 5min, admin UI can lag.
8. **Stray one-off scripts** in `backend/` root (`check_*.py`, `reset_db.py`, `scratch.py`, `migrate_*_map.py`, ...) and `frontend/replace_variants_ui.py`, `backend/s3test/` are ad-hoc utilities, not app code. `test_variant_groups.py` at backend root is NOT picked up by pytest.
9. **Tests need no Redis or DB server** — `tests/conftest.py` swaps in `FakeRedis` and in-memory SQLite, and disables rate limiting. If tests fail on Redis/connection, the conftest wiring broke.
10. **Python version:** pyproject says `>=3.11`, ruff targets `py312`, Docker uses `3.11-slim`. Stay 3.11-compatible.
11. **Redis is optional at runtime** — `utils/redis.py` degrades gracefully (caching no-ops), but the app DOES require Postgres/SQLite to be reachable.
12. **Root `package-lock.json` is a stub**; the real npm project is `frontend/`.
13. **`plan_docs/` and `.kiro/` are gitignored** — present locally, not in clones.

## Invariants

- Never commit `backend/.env`, root `.env`, `plantoga.db`, `backend/static/`, `logs/`.
- Never store absolute image URLs in DB — only relative keys resolved at render time.
- Never let route handlers query the ORM directly for anything non-trivial — go through `services/`.
- Keep API responses behind `/api/v1`.
- Don't add frontend test tooling unless asked; only backend has a suite.
