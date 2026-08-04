.PHONY: install dev test seed seed-catalog migrate lint format frontend-install frontend-dev frontend-build

# ─── Backend ────────────────────────────────────────────────

install:
	cd backend && uv sync --all-extras

dev:
	cd backend && uv run fastapi dev

test:
	cd backend && uv run pytest tests/ -v

seed:
	cd backend && uv run python seed.py

seed-catalog:
	cd backend && uv run python seed.py --only-catalog

migrate:
	cd backend && uv run alembic upgrade head

lint:
	cd backend && uv run ruff check .

format:
	cd backend && uv run ruff format .

# ─── Frontend ───────────────────────────────────────────────

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
